# ZyroNex — Claude Instructions

## Language
Always respond in Greek. Use English only for technical terms and code identifiers. Never use other languages.

## Merge & Deploy
After finishing a task and passing node --check, merge the working branch into main and push. Netlify auto-deploys. Do not ask the user to merge manually.

```
git checkout main
git pull origin main
git merge <branch>
git push origin main
```
