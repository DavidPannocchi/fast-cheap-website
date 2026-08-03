#!/bin/sh
# .git/hooks/pre-push
# Builda e deploya su Cloudflare Pages automaticamente ogni volta che fai
# `git push`, prima che il push venga effettivamente inviato a GitHub.
#
# NOTA: questo file vive dentro .git/hooks/, che NON è tracciato da git —
# funziona solo su QUESTO computer. Se lavori da un altro PC, va ricreato lì.

echo "Pre-push: build + deploy su Cloudflare Pages..."

npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build fallita — push interrotto, deploy non eseguito."
  exit 1
fi

npx wrangler pages deploy dist --project-name=pronto-site
if [ $? -ne 0 ]; then
  echo "❌ Deploy Cloudflare fallito — controlla l'output sopra."
  exit 1
fi

echo "✅ Deploy completato, procedo col push."
exit 0
