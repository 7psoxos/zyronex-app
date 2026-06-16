// campaigns.js — lazy-loaded module for Email Marketing Campaigns
// Dependencies (stay in index.html): CUSTOMERS, sb, toast, openModal, closeModal, lucide, sendEmail, showConfirm, getSettings, dateGR, addDays, askClaude
/* ============================================================
   CAMPAIGNS (Email Marketing)
   ============================================================ */
async function renderCampaigns(){
  const withEmail = CUSTOMERS.filter(c=>c.email);
  const vipCustomers = CUSTOMERS.filter(c=>c.totalSpent>=500);
  const goldPlus = CUSTOMERS.filter(c=>['gold','platinum'].includes(c.loyaltyTier));
  const inactive = CUSTOMERS.filter(c=>{
    if(!c.lastVisit) return false;
    const days = (Date.now() - new Date(c.lastVisit).getTime()) / 86400000;
    return days >= 30;
  });

  // Φόρτωση recent campaigns
  let recentCampaigns = [];
  try{
    const {data} = await sb.from('email_logs')
      .select('campaign_name, sent_at, status')
      .order('sent_at', {ascending:false})
      .limit(50);
    if(data){
      // Group by campaign
      const grouped = {};
      data.forEach(row=>{
        if(!row.campaign_name) return;
        if(!grouped[row.campaign_name]){
          grouped[row.campaign_name] = {
            name: row.campaign_name,
            sent_at: row.sent_at,
            total: 0, success: 0
          };
        }
        grouped[row.campaign_name].total++;
        if(row.status === 'sent') grouped[row.campaign_name].success++;
      });
      recentCampaigns = Object.values(grouped).slice(0,10);
    }
  }catch(e){console.warn(e)}

  const html=`<div class="page-head">
    <div><div class="page-title">Προσφορές & Email Marketing</div>
    <div class="page-sub">${withEmail.length} πελάτες με email • Powered by Resend</div></div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="section-title">📧 Νέα Καμπάνια</div>

      <div class="form-row mt-3"><label class="form-label">Αποδέκτες</label>
        <select class="form-select" id="camp_audience" onchange="updateCampTargetCount()">
          <option value="all">Όλοι με email (${withEmail.length})</option>
          <option value="vip">VIP πελάτες > 500€ (${vipCustomers.length})</option>
          <option value="gold">Gold & Platinum tier (${goldPlus.length})</option>
          <option value="inactive">Ανενεργοί > 30 ημέρες (${inactive.length})</option>
        </select>
      </div>

      <div class="form-row"><label class="form-label">Όνομα καμπάνιας (internal)</label>
        <input class="form-input" id="camp_name" placeholder="π.χ. Καλοκαιρινές Προσφορές" value="Καμπάνια ${new Date().toLocaleDateString('el-GR')}">
      </div>

      <div class="form-row"><label class="form-label">Θέμα Email</label>
        <input class="form-input" id="camp_subject" placeholder="π.χ. 🔥 -20% σε όλα τα υγρά αυτή την εβδομάδα!">
      </div>

      <div class="form-row"><label class="form-label">Μήνυμα (HTML)</label>
        <textarea class="form-input" id="camp_body" rows="10" placeholder="Γράψε το μήνυμα... {NAME} = όνομα πελάτη, {POINTS} = πόντοι">Αγαπητέ/ή {NAME},

Σας ενημερώνουμε για τις νέες μας προσφορές!

🎁 -20% σε όλα τα υγρά αναπλήρωσης
⚡ Ελέγξτε τους ${CUSTOMERS[0]?.loyaltyPoints||0} πόντους σας
🔥 Περιορισμένη διάρκεια έως ${dateGR(addDays(7))}

Σας περιμένουμε στο κατάστημα!

Με εκτίμηση,
${getSettings().shopName||'Η ομάδα μας'}</textarea>
      </div>

      <div class="ai-box mb-3" style="padding:10px">
        <div class="text-xs">💡 <b>Tips:</b> Χρησιμοποίησε <code>{NAME}</code> και <code>{POINTS}</code> για personalization</div>
      </div>

      <div class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-primary btn-lg" onclick="launchCampaign()"><i data-lucide="send" size="16"></i> <span id="campSendBtnText">Αποστολή σε ${withEmail.length}</span></button>
        <button class="btn btn-ghost" onclick="aiGenerateCampaignText()"><i data-lucide="sparkles" size="16"></i> ZyroNex Πρόταση</button>
        <button class="btn btn-ghost" onclick="previewCampaign()"><i data-lucide="eye" size="16"></i> Προεπισκόπηση</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">📜 Πρόσφατες Καμπάνιες</div>
      <div class="mt-3">
      ${recentCampaigns.length === 0
        ? '<div class="muted text-sm" style="padding:20px;text-align:center">Δεν έχεις στείλει καμπάνιες ακόμα</div>'
        : recentCampaigns.map(c=>`<div style="padding:14px;border-radius:10px;background:var(--bg-2);margin-bottom:10px">
          <div class="fw-700">${c.name}</div>
          <div class="text-xs muted mt-2">Εστάλη σε ${c.total} πελάτες • ${new Date(c.sent_at).toLocaleDateString('el-GR')}</div>
          <div class="mt-2 flex gap-2">
            <span class="chip chip-ok">${c.success} επιτυχείς</span>
            ${c.total-c.success>0?`<span class="chip chip-danger">${c.total-c.success} αποτυχίες</span>`:''}
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
  document.getElementById('content').innerHTML=html;lucide.createIcons();
}

function updateCampTargetCount(){
  const audience = document.getElementById('camp_audience')?.value;
  const list = getCampaignTargets(audience);
  const btn = document.getElementById('campSendBtnText');
  if(btn) btn.textContent = `Αποστολή σε ${list.length}`;
}

function getCampaignTargets(audience){
  const withEmail = CUSTOMERS.filter(c=>c.email);
  if(audience === 'vip') return withEmail.filter(c=>c.totalSpent>=500);
  if(audience === 'gold') return withEmail.filter(c=>['gold','platinum'].includes(c.loyaltyTier));
  if(audience === 'inactive'){
    return withEmail.filter(c=>{
      if(!c.lastVisit) return false;
      const days = (Date.now() - new Date(c.lastVisit).getTime()) / 86400000;
      return days >= 30;
    });
  }
  return withEmail;
}

function previewCampaign(){
  const c = CUSTOMERS.filter(x=>x.email)[0] || {name:'Παράδειγμα Πελάτη', loyaltyPoints:0};
  const subject = document.getElementById('camp_subject').value || '(κενό θέμα)';
  let body = document.getElementById('camp_body').value || '';
  body = body.replace(/\{NAME\}/g, c.name).replace(/\{POINTS\}/g, c.loyaltyPoints||0);

  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">Προεπισκόπηση Email</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body">
    <div style="border:1px solid var(--border);border-radius:10px;padding:16px;background:#fff;color:#000">
      <div style="border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:16px">
        <div style="font-size:11px;color:#666">Προς: ${c.name} &lt;${c.email||'—'}&gt;</div>
        <div style="font-weight:700;margin-top:4px">${subject}</div>
      </div>
      <div style="border-top:4px solid #d4ff3a;padding-top:16px;white-space:pre-wrap;font-family:Arial,sans-serif">${body}</div>
    </div>
    <div class="flex gap-2 mt-4">
      <button class="btn btn-primary" onclick="closeModal()">Κλείσιμο</button>
    </div>
  </div>`);
}

async function aiGenerateCampaignText(){
  const subject = document.getElementById('camp_subject');
  const body = document.getElementById('camp_body');

  toast('Το ZyroNex γράφει το κείμενο...','warn');
  try{
    const s = getSettings();
    const text = await askClaude(
      [{role:'user', content:`Γράψε καμπάνια email marketing για ελληνικό vape κατάστημα "${s.shopName||'ZyroNex'}". ΤΙΜΕΣ ΣΕ €.

Απαίτηση:
- Subject line δυνατό (μέχρι 50 χαρακτήρες) σε 1η γραμμή με πρόθεμα "SUBJECT: "
- Body 100-150 λέξεις από 2η γραμμή
- Χρήση placeholder {NAME} για το όνομα
- Χρήση placeholder {POINTS} για τους πόντους
- Συγκεκριμένη προσφορά (π.χ. -20% για 7 ημέρες)
- Emoji στην αρχή του subject
- Call-to-action στο τέλος

Παράδειγμα μορφής:
SUBJECT: 🔥 {NAME}, σου ετοιμάσαμε κάτι ξεχωριστό!
[body εδώ]`}],
      'Είσαι expert copywriter email marketing. Τιμές ΠΑΝΤΑ σε €.'
    );

    const lines = text.split('\n');
    const subjectLine = lines.find(l=>l.toUpperCase().startsWith('SUBJECT:'));
    if(subjectLine){
      subject.value = subjectLine.replace(/^SUBJECT:\s*/i,'').trim();
      body.value = lines.filter(l=>!l.toUpperCase().startsWith('SUBJECT:')).join('\n').trim();
    }else{
      body.value = text;
    }
    toast('ZyroNex Πρόταση Έτοιμη','success');
  }catch(err){
    toast('AI σφάλμα: '+err.message,'danger');
  }
}

async function launchCampaign(){
  const audience = document.getElementById('camp_audience').value;
  const campaignName = document.getElementById('camp_name').value.trim() || 'Campaign';
  const subject = document.getElementById('camp_subject').value.trim();
  const bodyTemplate = document.getElementById('camp_body').value.trim();

  if(!subject){toast('Συμπλήρωσε θέμα','danger');return}
  if(!bodyTemplate){toast('Συμπλήρωσε μήνυμα','danger');return}

  const targets = getCampaignTargets(audience);
  if(targets.length === 0){toast('Δεν υπάρχουν παραλήπτες','warn');return}

  showConfirm(`Θα σταλεί email σε ${targets.length} πελάτες. Συνέχεια;`, ()=>_sendCampaignRun(targets, subject, bodyTemplate));
}

async function _sendCampaignRun(targets, subject, bodyTemplate){
  // Progress modal
  openModal(`<div class="modal-body" style="text-align:center;padding:40px">
    <div style="width:50px;height:50px;border:4px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto"></div>
    <div class="fw-700 text-lg mt-4">Αποστολή Emails...</div>
    <div class="muted mt-2" id="campProgress">0 / ${targets.length}</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`);

  let ok = 0, failed = 0;
  for(let i=0; i<targets.length; i++){
    const c = targets[i];
    const personalBody = bodyTemplate
      .replace(/\{NAME\}/g, c.name)
      .replace(/\{POINTS\}/g, c.loyaltyPoints||0)
      .replace(/\{TIER\}/g, c.loyaltyTier||'bronze');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="border-top:4px solid #d4ff3a;padding-top:20px;white-space:pre-wrap">${personalBody}</div>
      <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#888">Στάλθηκε από το ${getSettings().shopName||'ZyroNex'}</div>
    </body></html>`;

    try{
      await sendEmail({
        to: c.email, subject,
        html, text: personalBody,
        customerId: c.id
      });
      ok++;
    }catch(e){
      failed++;
      console.error(`Failed to ${c.email}:`, e.message);
    }

    const prog = document.getElementById('campProgress');
    if(prog) prog.textContent = `${i+1} / ${targets.length}`;

    if(i < targets.length - 1) await new Promise(r=>setTimeout(r, 150));
  }

  closeModal();
  toast(`✅ Εστάλησαν ${ok} emails${failed>0?` (${failed} αποτυχίες)`:''}`, ok>0?'success':'danger');
  renderCampaigns();
}
/* ============================================================
   CAMPAIGNS end
   ============================================================ */

// Expose all functions globally after lazy load
(function() {
  var toExport = [renderCampaigns, updateCampTargetCount, getCampaignTargets, previewCampaign, aiGenerateCampaignText, launchCampaign, _sendCampaignRun];
  var i;
  for (i = 0; i < toExport.length; i++) {
    if (typeof toExport[i] === 'function') { window[toExport[i].name] = toExport[i]; }
  }
})();
export { renderCampaigns };
