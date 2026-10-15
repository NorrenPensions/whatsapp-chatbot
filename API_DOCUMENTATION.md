# Chatbot API — Vendor Integration Documentation

This document provides complete technical specifications for integrating with the Chatbot API service. It outlines authentication requirements, supported endpoints, request/response formats, error handling, and rate limits.

---

## 1. General Information & Transport

- **Base URL:** `https://<api-host>` (The public production URL and port will be provided by the API operator)
- **Transport Security:** All traffic must use HTTPS.
- **Request & Response Content-Type:** JSON
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- **Identifier Parameters (`mobileNumOrPin`):**
  Endpoints accepting `mobileNumOrPin` support either:
  - **RSA PIN:** In standard format (e.g., `PEN` followed by 12 digits: `PEN000000000001`).
  - **Nigerian Mobile Number:** In international format starting with `234` followed by 10 digits (e.g., `2348012345678`).

---

## 2. Authentication & Security

### HTTP Basic Authentication
Protected endpoints require HTTP Basic Authentication. Credentials (`username` and `password`) are issued by the API operator.

Send credentials in the standard HTTP `Authorization` header:
```http
Authorization: Basic <base64-encoded-username:password>
```

### Rate Limiting & Access Control
- **Rate Limit:** 60 requests per minute per source IP on protected routers. Exceeding this limit returns `429 Too Many Requests` with a `Retry-After` header (in seconds).
- **IP Whitelisting:** If configured by the operator, only requests originating from approved client IP addresses are accepted (`403 Forbidden` returned otherwise).
- **Credentials Protection:** Do not log credentials or pass them via query parameters.

---

## 3. Endpoints Overview

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check and service status |
| `POST` | `/balance/my-bal` | Yes (Basic) | Retrieve member RSA balance |
| `POST` | `/client-details/my-pin` | Yes (Basic) | Retrieve member RSA PIN from mobile number |
| `POST` | `/client-details/my-email` | Yes (Basic) | Retrieve member registered email |
| `PUT` | `/client-details/update-email` | Yes (Basic) | Update member registered email |
| `POST` | `/client-details/data-recapture-status` | Yes (Basic) | Check NIN/BVN data recapture status |
| `POST` | `/client-details/embassy-letter-details` | Yes (Basic) | Retrieve embassy letter profile and balance details |
| `POST` | `/office-location/state` | No | List service center branch offices by state |
| `POST` | `/statement/send-statement` | No | Generate account statement PDF and email to member |
| `POST` | `/embassy-letter/generate-and-send` | Yes (Basic) | Generate embassy letter PDF and email to member |
| `POST` | `/welcome-letter/generate` | Yes (Basic) | Generate welcome certificate PDF and email to member |

---

## 4. Endpoint Specifications

### 4.1 Health Check

```http
GET /health/
```

- **Authentication:** None
- **Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "service": "chatbot api service"
  }
  ```

---

### 4.2 Retrieve Member Balance

```http
POST /balance/my-bal
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  Returns numeric RSA balance (as a number or string representation):
  ```json
  1524300.50
  ```
- **Error Responses:**
  - `404 Not Found`:
    ```json
    { "message": "The provided RSA PIN does not exist." }
    ```
  - `500 Internal Server Error`:
    ```json
    { "message": "An error occurred while fetching balances" }
    ```

---

### 4.3 Retrieve Member PIN

```http
POST /client-details/my-pin
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "2348012345678"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "pin": "PEN000000000001"
  }
  ```
- **Error Responses:**
  - `404 Not Found`:
    ```json
    { "message": "The provided mobile number does not exist." }
    ```

---

### 4.4 Retrieve Member Registered Email

```http
POST /client-details/my-email
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "email": "customer@example.com"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin is required" }`
  - `404 Not Found`: `{ "message": "The provided RSA PIN does not exist." }` or `{ "message": "No email address found for this account." }`

---

### 4.5 Update Registered Email

```http
PUT /client-details/update-email
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001",
    "newEmail": "updated.email@example.com"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "message": "Email updated successfully"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin and newEmail are required" }`
  - `404 Not Found`: `{ "message": "The provided RSA PIN does not exist." }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while updating email" }`

---

### 4.6 Check Data Recapture Status

Checks whether the customer has completed their mandatory NIN/BVN data recapture with the pension administrator.

```http
POST /client-details/data-recapture-status
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "recaptured": true
  }
  ```
  *(Returns `true` when data recapture has been completed; `false` otherwise)*
- **Response Headers:** `Cache-Control: no-store`
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin is required" }`
  - `404 Not Found`: `{ "message": "The provided RSA PIN does not exist." }`
  - `502 Bad Gateway`: `{ "message": "Unable to retrieve data recapture status" }`
  - `504 Gateway Timeout`: `{ "message": "The data recapture status request timed out" }`

---

### 4.7 Retrieve Embassy Letter Details

Fetches the complete profile and balance summary formatted for visa/embassy verification purposes.

```http
POST /client-details/embassy-letter-details
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "pin": "PEN000000000001",
    "firstName": "JOHN",
    "surname": "DOE",
    "otherNames": "ALEX",
    "fullName": "JOHN ALEX DOE",
    "email": "john.doe@example.com",
    "employerName": "ACME CORPORATION NIGERIA",
    "balance": 1500000.75,
    "formattedBalance": "1,500,000.75",
    "balanceInWords": "One Million, Five Hundred Thousand Naira and Seventy-Five Kobo Only"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin is required" }`
  - `404 Not Found`: `{ "message": "Client details not found for this account." }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while fetching embassy letter details" }`

---

### 4.8 Service Center Office Locations

Find service centers and branch offices located within a specific Nigerian state.

```http
POST /office-location/state
```

- **Authentication:** None
- **Request Body:**
  ```json
  {
    "state": "Lagos"
  }
  ```
- **Response (`200 OK`):**
  ```json
  [
    {
      "state": "Lagos",
      "officeName": "Ikeja Service Centre",
      "city": "Ikeja",
      "address": "Plot 12, Commercial Avenue, Ikeja",
      "personnel": "Jane Doe",
      "phone": "08012345678"
    }
  ]
  ```
- **Error Responses:**
  - `400 Bad Request`:
    ```json
    { "message": "Please provide a state" }
    ```
  - `500 Internal Server Error`:
    ```json
    { "message": "An error occurred while fetching office location" }
    ```

---

### 4.9 Generate & Send E-Statement of Account

Generates an official adhoc account statement PDF for the specified date range and delivers it to the customer's registered email address on file.

```http
POST /statement/send-statement
```

- **Authentication:** None
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-12-31"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "code": 200,
    "message": "Statement generated and sent successfully to customer@example.com",
    "recipient": "customer@example.com"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "PIN, from, and to are required" }`
  - `404 Not Found`: `{ "error": "No user email found for the provided PIN" }` or `{ "error": "No statement header found for the provided PIN" }`
  - `500 Internal Server Error`: `{ "error": "An error occurred while generating and sending the statement." }`

---

### 4.10 Generate & Send Embassy Confirmation Letter

Generates an official embassy letter addressed to the specified diplomatic mission/country confirming retirement savings balance, and emails the PDF.

```http
POST /embassy-letter/generate-and-send
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001",
    "country": "United Kingdom",
    "employerName": "ACME Nigeria Ltd",
    "email": "optional.override@example.com"
  }
  ```
  - `mobileNumOrPin` (*required*): RSA PIN or registered mobile number.
  - `country` (*required*): Destination country for diplomatic mission lookup (e.g., `United Kingdom`, `Canada`, `United States`).
  - `employerName` (*optional*): Employer name override; defaults to registered employer.
  - `email` (*optional*): Delivery email override; defaults to registered employee email.
- **Response (`200 OK`):**
  ```json
  {
    "code": 200,
    "message": "Embassy letter generated and sent successfully to customer@example.com",
    "recipient": "customer@example.com"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin and country are required" }`
  - `404 Not Found`: `{ "message": "Diplomatic mission details not found for country: <country>" }` or `{ "message": "No email address found for this account" }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while generating embassy letter" }`

---

### 4.11 Generate & Send Welcome Letter (Registration Certificate)

Generates the official Welcome Letter & Certificate of Registration PDF with customer photograph and emails it to the registered email address.

```http
POST /welcome-letter/generate
```
*(Alias: `POST /welcome-letter/generate-and-send`)*

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "code": 200,
    "message": "Welcome letter generated and sent successfully",
    "recipient": "customer@example.com"
  }
  ```
- **Response Headers:** `Cache-Control: no-store`
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin must be an RSA PIN (PEN followed by 12 digits) or a mobile number (234 followed by 10 digits)" }`
  - `404 Not Found`: `{ "message": "Customer not found" }` or `{ "message": "No registered email address found for this customer" }`
  - `422 Unprocessable Entity`: `{ "message": "The registered email address is invalid" }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while generating or sending welcome letter" }`

---

## 5. Standard Error Status Codes

| HTTP Status | Description | Notes |
|---|---|---|
| `400 Bad Request` | Missing or malformed parameters | Inspect `message` or `error` in response body |
| `401 Unauthorized` | Missing or invalid Basic Auth credentials | Includes `WWW-Authenticate: Basic` header |
| `403 Forbidden` | IP address blocked / not allowed | Originating IP is not in configured allowlist |
| `404 Not Found` | Entity (PIN, phone, country mission) not found | Returned when resource does not exist |
| `422 Unprocessable Entity` | Semantic validation failure | E.g., customer has invalid email format |
| `429 Too Many Requests` | Rate limit exceeded | Max 60 req/min; inspect `Retry-After` header |
| `500 Internal Server Error` | Database or internal processing error | Internal server failure |
| `502 Bad Gateway` | Upstream partner integration error | Partner API returned failure |
| `504 Gateway Timeout` | Upstream partner request timeout | Partner API timed out (30s) |

---

## 6. Sample Request (cURL)

```bash
# Example: Fetching client balance with Basic Auth
curl --location --request POST 'https://<api-host>/balance/my-bal' \
--header 'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--data '{
    "mobileNumOrPin": "PEN000000000001"
}'
```
