wrangler d1 migrations apply db_skimap --local
wrangler dev \
    --config "wrangler.toml" \
    --local-protocol "https" \
    --https-cert-path "cert/localhost+3.pem" \
    --https-key-path "cert/localhost+3-key.pem" \
    --ip 0.0.0.0 \
    --port 443
