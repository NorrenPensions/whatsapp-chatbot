-- ============================================================
-- ChatbotApiLog - API Usage Metrics Table
-- Database: PFA
-- Created: 2026-10-16
-- Description: Logs all API calls to the chatbot-api for 
--              usage tracking, performance monitoring, and 
--              reporting.
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ChatbotApiLog'
)
BEGIN
    CREATE TABLE PFA.dbo.ChatbotApiLog (
        id                  INT IDENTITY(1,1)   PRIMARY KEY,
        endpoint            VARCHAR(255)        NOT NULL,
        method              VARCHAR(10)         NOT NULL,
        status_code         INT                 NULL,
        response_time_ms    INT                 NULL,
        client_ip           VARCHAR(50)         NULL,
        vendor_username     VARCHAR(100)        NULL,
        user_agent          VARCHAR(500)        NULL,
        request_summary     VARCHAR(500)        NULL,
        error_message       VARCHAR(1000)       NULL,
        created_at          DATETIME            NOT NULL DEFAULT GETDATE()
    );

    -- Index for querying by endpoint (e.g. "show me all /balance calls")
    CREATE NONCLUSTERED INDEX IX_ChatbotApiLog_endpoint 
        ON PFA.dbo.ChatbotApiLog(endpoint);

    -- Index for date-range queries (e.g. "calls in the last 7 days")
    CREATE NONCLUSTERED INDEX IX_ChatbotApiLog_created_at 
        ON PFA.dbo.ChatbotApiLog(created_at);

    -- Composite index for common report queries
    CREATE NONCLUSTERED INDEX IX_ChatbotApiLog_endpoint_created_at 
        ON PFA.dbo.ChatbotApiLog(endpoint, created_at)
        INCLUDE (status_code, response_time_ms);

    PRINT 'Table PFA.dbo.ChatbotApiLog created successfully.';
END
ELSE
BEGIN
    PRINT 'Table PFA.dbo.ChatbotApiLog already exists. Skipping creation.';
END
