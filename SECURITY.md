# API credential configuration

The `/client-details` routes require HTTPS and HTTP Basic Authentication. The
health endpoint remains public. Credentials are loaded from the deployment
secret store through `API_BASIC_AUTH_CREDENTIALS`; do not commit them or put
them in URLs, request bodies, or logs.

Configure `API_BASIC_AUTH_CREDENTIALS` as a JSON array of objects with unique
usernames and passwords of at least 32 characters. Use a randomly generated
password for each vendor credential (for example, 32 random bytes encoded as
base64url); a vendor ID may be used as the username, but never as the password.
The setting's value has this shape:

```json
[{"username":"vendor-one","password":"<random secret of at least 32 characters>"}]
```

Keep the value in a secret manager rather than source code. The server does not
log authorization headers.

To rotate credentials without downtime, add the new credential alongside the
old credential, deploy the updated secret, switch the vendor to the new
credential, then remove the old entry. To revoke a credential, remove its entry
and redeploy. Credentials are restricted to the `/client-details` router.

The API also limits this router to 60 requests per source IP per minute. An
optional `CLIENT_DETAILS_ALLOWED_IPS` setting can further restrict access to a
comma-separated list of exact IP addresses. When TLS terminates at a reverse
proxy, set `TRUSTED_PROXY_IPS` to that proxy's exact IP address(es) so Express
can safely recognize forwarded HTTPS requests. Do not trust arbitrary
forwarded headers or enable unrestricted proxy trust. Ensure the proxy itself
rejects HTTP or redirects it before forwarding requests to this service. The
in-process rate limit is per application instance; use a shared gateway or
distributed limiter as well when running multiple instances.
