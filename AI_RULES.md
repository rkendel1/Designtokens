# AI Development Rules for Design Tokens Crawler

This document provides clear rules and guidelines for any AI developer working on this project. Adhering to these rules ensures consistency, maintainability, and adherence to the established architecture.

## Tech Stack Overview

The application is a Node.js-based system. The core technologies are:

-   **Backend Framework**: **Express.js** is used to build and manage the RESTful API server.
-   **Web Crawling**: **Playwright** provides powerful headless browser automation, essential for rendering and interacting with modern, JavaScript-heavy websites.
-   **HTML Parsing**: **Cheerio** is used for fast, server-side parsing and manipulation of static HTML content, similar to jQuery.
-   **AI & NLP**: The **OpenAI API** (GPT-4, embeddings) is the primary tool for analysis, normalization, and summarization. The system also supports local LLMs via **Ollama**.
-   **Database**: **PostgreSQL** is the database of choice, with the **`pgvector`** extension used for storing and querying vector embeddings.
-   **PDF Generation**: **PDFKit** is used to dynamically create the brand profile PDF reports.
-   **HTTP Client**: **Axios** is the standard client for making external HTTP requests (e.g., to Ollama or fetching `robots.txt`).
-   **Testing**: The testing suite is built on **Jest** for the core framework and **Supertest** for API endpoint testing.
-   **Image Analysis**: **ColorThief** is used to extract dominant colors from screenshots.

## Library Usage Rules

To maintain a clean and predictable codebase, follow these strict rules for library usage. All logic should be encapsulated in the appropriate module.

### 1. API Server & Middleware
-   **Express.js**: MUST be used for all HTTP routing, request/response handling, and middleware integration. All API logic resides in `server.js`.
-   **Helmet.js & CORS**: MUST be used for securing HTTP headers and managing cross-origin requests.
-   **express-rate-limit**: MUST be used for protecting API endpoints from abuse.
-   **node-cache**: SHOULD be used for in-memory caching of API responses.

### 2. Web Crawling & Data Extraction
-   **Playwright**: MUST be used for navigating to pages, rendering JavaScript, handling user interactions (like scrolling), and taking screenshots. Use it when you need a full browser environment.
-   **Cheerio**: MUST be used for parsing and extracting data from static HTML that has already been fetched. It is significantly faster than Playwright for this purpose. Do not use it for sites that require JavaScript rendering.
-   **robots-parser**: MUST be used to check `robots.txt` compliance before crawling any URL.

### 3. AI & Language Models
-   **openai (library)**: MUST be used for all interactions with the OpenAI API. All calls MUST be made through the abstraction layer in `llm.js`.
-   **Axios**: MUST be used for making requests to local LLM providers like Ollama. This logic is also contained within `llm.js`.
-   **NEVER** place direct calls to AI providers outside of `llm.js`.

### 4. Database Operations
-   **pg (node-postgres)**: MUST be used for all communication with the PostgreSQL database.
-   **store.js**: All database queries and logic MUST be encapsulated within the `store.js` module. No other file should contain raw SQL or direct database connections. This maintains a clear data access layer.

### 5. PDF Generation
-   **PDFKit**: MUST be used for generating all PDF documents. This logic is exclusively handled by `pdf-generator.js`.

### 6. Image Processing
-   **ColorThief**: MUST be used for extracting color palettes from screenshots. This logic is located within `crawler.js`.

### 7. Testing
-   **Jest**: MUST be used as the framework for all unit and integration tests.
-   **Supertest**: MUST be used for writing tests that make HTTP requests to the Express.js API endpoints.

By following these guidelines, we ensure that the project remains organized, scalable, and easy for any developer to understand.