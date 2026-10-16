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
| `POST` | `/balance/my-growth` | Yes (Basic) | Retrieve member RSA total growth |
| `POST` | `/client-details/my-pin` | Yes (Basic) | Retrieve member RSA PIN from mobile number |
| `POST` | `/client-details/my-email` | Yes (Basic) | Retrieve member registered email |
| `PUT` | `/client-details/update-email` | Yes (Basic) | Update member registered email |
| `PUT` | `/client-details/update-phone` | Yes (Basic) | Update member registered mobile number |
| `POST` | `/client-details/data-recapture-status` | Yes (Basic) | Check NIN/BVN data recapture status |
| `POST` | `/client-details/embassy-letter-details` | Yes (Basic) | Retrieve embassy letter profile and balance details |
| `POST` | `/office-location/state` | No | List service center branch offices by state |
| `POST` | `/statement/send-statement` | No | Generate account statement PDF and email to member |
| `POST` | `/embassy-letter/generate-and-send` | Yes (Basic) | Generate embassy letter PDF and email to member |
| `POST` | `/welcome-letter/generate` | Yes (Basic) | Generate welcome certificate PDF and email to member |
| `GET` / `POST` | `/fund-prices` | No | Retrieve list of current fund prices or filter by fund code |
| `GET` / `POST` | `/benefit-status` | Yes (Basic) | Retrieve current benefit payment application status |
| `POST` | `/verify-customer/send-otp` | Yes (Basic) | Send OTP for customer identity verification |
| `POST` | `/verify-customer/verify-otp` | Yes (Basic) | Verify OTP and retrieve customer details |

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

### 4.3 Retrieve Member Total Growth

```http
POST /balance/my-growth
POST /balance/growth
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`):**
  Returns numeric total growth:
  ```json
  245600.75
  ```
- **Error Responses:**
  - `404 Not Found`:
    ```json
    { "message": "The provided RSA PIN does not exist." }
    ```
  - `500 Internal Server Error`:
    ```json
    { "message": "An error occurred while fetching growth" }
    ```

---

### 4.4 Retrieve Member PIN

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

### 4.5 Retrieve Member Registered Email

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

### 4.6 Update Registered Email

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

### 4.7 Update Registered Mobile Number

```http
PUT /client-details/update-phone
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001",
    "newMobileNum": "2348012345678"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "message": "Mobile number updated successfully"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "message": "mobileNumOrPin and newMobileNum are required" }`
  - `404 Not Found`: `{ "message": "The provided RSA PIN does not exist." }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while updating mobile number" }`

---

### 4.8 Check Data Recapture Status

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

### 4.9 Retrieve Embassy Letter Details

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

### 4.10 Service Center Office Locations

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

### 4.11 Generate & Send E-Statement of Account

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

### 4.12 Generate & Send Embassy Confirmation Letter

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

### 4.13 Generate & Send Welcome Letter (Registration Certificate)

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

### 4.14 Retrieve Fund Prices

```http
GET /fund-prices
POST /fund-prices
GET /fund-prices/:fundCode
```

- **Authentication:** None
- **Headers:**
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Parameters / Payload (Optional):**
  - Query parameter: `?fundCode=FUND2`
  - URL parameter: `/fund-prices/FUND2`
  - JSON Body (for POST):
    ```json
    {
      "fundCode": "FUND2"
    }
    ```
- **Response — Full List (`200 OK`):**
  ```json
  [
    {
      "fundCode": "FUND2",
      "fundName": "NORRENBERGER RSA FUND II",
      "fundPrice": 7.1971,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND4",
      "fundName": "NORRENBERGER RETIREE FUND IV",
      "fundPrice": 7.2424,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "TCF",
      "fundName": "NORRENBERGER TRANSITIONAL CONTRIBUTION FUND",
      "fundPrice": 4.9854,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND1",
      "fundName": "RSA FUND I",
      "fundPrice": 3.2219,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND3",
      "fundName": "RSA FUND III",
      "fundPrice": 2.8443,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "CRA",
      "fundName": "RSA CONTRIBUTION RECONCIILIATION FUND",
      "fundPrice": 1.7737,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "ALLOC",
      "fundName": "ALLOCATION ACCOUNT FUND",
      "fundPrice": 0.0,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND5",
      "fundName": "Personal Pension Plan(PPP)",
      "fundPrice": 1.8345,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "RLA",
      "fundName": "RETIREE ANNUITY SUSPENSE ACCOUNT",
      "fundPrice": 1.0061,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND6",
      "fundName": "NON-INTEREST FUND(ACTIVE FUND VI)",
      "fundPrice": 1.8964,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": "FUND6R",
      "fundName": "NON-INTEREST FUND (RETIREE FUND VI)",
      "fundPrice": 1.6566,
      "valuationDate": 1791932400000
    },
    {
      "fundCode": null,
      "fundName": "FOREIGN CURRENCY DOLLAR FUND VII",
      "fundPrice": 0.0,
      "valuationDate": 1791932400000
    }
  ]
  ```
- **Response — Single Fund (`200 OK`):**
  ```json
  {
    "fundCode": "FUND2",
    "fundName": "NORRENBERGER RSA FUND II",
    "fundPrice": 7.1971,
    "valuationDate": 1791932400000
  }
  ```
- **Error Responses:**
  - `404 Not Found`: `{ "message": "Fund with code 'INVALID' not found." }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while fetching fund prices" }`
  - `502 Bad Gateway`: `{ "message": "Unexpected response format from partner fund prices service" }`

---

### 4.15 Retrieve Benefit Application Status

```http
POST /benefit-status
POST /benefit-status/status
GET /benefit-status
GET /benefit-status/:pinOrMobile
```

- **Authentication:** Basic Auth
- **Headers:**
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Parameters:**
  - **POST Body:**
    ```json
    {
      "mobileNumOrPin": "PEN100771157719"
    }
    ```
    *(Also accepts `"rsaPin"` or `"pin"` as payload field, or standard Nigerian mobile number starting with `234`)*
  - **GET Query Parameters:** `?mobileNumOrPin=PEN100771157719` *(also accepts `rsaPin` or `pin`)*
  - **GET URL Parameter:** `/benefit-status/PEN100771157719`
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "statusId": 16,
      "status": "Approved for payment - payment instruction sent to Custodian",
      "rawStatus": "Approved by Finance",
      "benefitType": "EnBloc - Private",
      "applicantName": "Gaddafi Balarabe",
      "appDate": "2025-05-21T09:35:33.353Z"
    },
    "message": "Approved for payment - payment instruction sent to Custodian",
    "status": 200
  }
  ```
- **Status Stages Mapping:**
  - `2`: `Application received`
  - `4`: `Under Initial Review`
  - `8`: `Under internal review`
  - `14`: `Final stage of processing - awaiting approval for payment`
  - `16`: `Approved for payment - payment instruction sent to Custodian`
  - `18`: `Process completed`
- **Error Responses:**
  - `400 Bad Request`: `{ "data": null, "message": "Please provide mobileNumOrPin or rsaPin", "status": 400 }`
  - Not Found *(returned as HTTP `200` with `"status": 404` in response body)*: `{ "data": null, "message": "No request found for that pin", "status": 404 }`
  - `500 Internal Server Error`: `{ "data": null, "message": "An error occurred while fetching benefit status.", "status": 500 }`

---


### 4.16 Send Customer Verification OTP

Initiates customer identity verification by generating a one-time password (OTP) and delivering it via email (preferred) or SMS (fallback). A 60-second cooldown is enforced between OTP requests.

```http
POST /verify-customer/send-otp
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001"
  }
  ```
- **Response (`200 OK`) — Email delivery:**
  ```json
  {
    "message": "OTP successfully sent to your email.",
    "channel": "email",
    "status": 200
  }
  ```
- **Response (`200 OK`) — SMS fallback:**
  ```json
  {
    "message": "OTP successfully sent via SMS.",
    "channel": "sms",
    "status": 200
  }
  ```
- **Error Responses:**
  - `200 OK` *(Rate limited — OTP recently issued)*:
    ```json
    { "message": "An OTP was recently generated. Please wait 60 seconds before requesting another.", "status": 429 }
    ```
  - `200 OK` *(Invalid user)*:
    ```json
    { "message": "Invalid user or incorrect RSA pin." }
    ```
  - `400 Bad Request`: `{ "message": "We do not have a valid email or mobile phone number on your record. Kindly complete an update form with Norrenberger Pensions.", "status": 400 }`
  - `500 Internal Server Error`: `{ "message": "An error occurred while processing OTP request." }`

---

### 4.17 Verify Customer OTP

Validates a previously issued OTP. On success, returns the verified customer's profile details. OTPs expire after 10 minutes and are single-use.

```http
POST /verify-customer/verify-otp
```

- **Authentication:** Basic Auth
- **Request Body:**
  ```json
  {
    "mobileNumOrPin": "PEN000000000001",
    "otp": 234567
  }
  ```
- **Response (`200 OK`) — Verification successful:**
  ```json
  {
    "details": {
      "rsaPin": "PEN000000000001",
      "email": "customer@example.com",
      "surname": "DOE",
      "firstname": "JOHN",
      "othername": "ALEX",
      "phone": "08012345678"
    },
    "message": "Correct OTP submitted.",
    "status": 200
  }
  ```
- **Error Responses:**
  - `200 OK` *(Invalid or expired OTP)*:
    ```json
    { "message": "Invalid OTP or request not found.", "status": 400 }
    ```
    ```json
    { "message": "OTP has expired. Please request a new one.", "status": 400 }
    ```
    ```json
    { "message": "Incorrect OTP", "status": 400 }
    ```
  - `404 Not Found`: `{ "message": "Employee record not found.", "status": 404 }`

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
