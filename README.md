# Email Sniffer
Email Sniffer is a TypeScript service that infers a person's work email address from their name and company website.
It currently combines website and PDF evidence, common email-pattern inference, domain and MX-record checks, and SMTP verification before returning the highest-confidence candidate.

In the very near future, this tool will be hosted and you will be able to create a free account to use it with up to 25 searches daily. 
Anything above this will constitute enterprise scale and will require a paid plan.

If you instead want to clone the repo locally follow the below steps.

## Requirements
- Node.js 20 or newer
- npm
- A [Serper](https://serper.dev/) API key
- An email address and EHLO hostname for SMTP verification

## Setup

```bash
git clone https://github.com/Plasmatronics/Email-Sniffer.git
cd Email-Sniffer
npm install
```

Create a .env file and transfer the mocked variables from the example .env to your real .env files, and swapping the mocked variables for real ones:
| Variable             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `FROM_MAILBOX`       | Mailbox used as the sender during SMTP verification. |
| `SERPER_API_KEY`     | API key used for web searches through Serper.        |
| `SMTP_EHLO_HOSTNAME` | Hostname sent in the SMTP `EHLO` command.            |
| `SERVER_PORT`        | Port on which the HTTP server listens.               |

## Run the server
Start the service:
```bash
npm start
```

## API
### Infer an email address
`POST /email-inferences`

Request Body:
```json
{
	"firstName": "string",
    "lastName": "string",
    "companyUrl": "string"
}
```

An example successful inference returns an object like:
```json
{
	"success": true,
	"inferredEmail": "alice.smith@example.com",
	"confidence": 87,
	"pattern": "{firstName}.{lastName}",
	"catchAll": "not-catch-all"
}
```

If no suitable candidate can be verified, the service returns:
```json
{
	"success": false,
	"reason": "No suitable candidates found"
}
```

### Health check
`GET /health`
Checks integration + internet connectivity. 
The endpoint returns `200` when all vital integrations are healthy and `503` otherwise.

## Project structure

- `server.ts` - Express server and dependency wiring
- `src/services` - Email discovery, crawling, extraction, scoring, and SMTP verification (any internal service)
- `src/integrations` - External service integrations
- `src/shared` - Shared email-pattern definitions and generators
- `src/utils` - URL and email-related helpers

## License

This project is licensed under the ISC License.
