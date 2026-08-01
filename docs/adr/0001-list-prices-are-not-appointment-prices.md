# List prices are not appointment prices

PRD user story 17 says customer "prices" must never reach the language model, and
the Treatwell reducer strips them at the boundary. That refers to the *appointment
price* — what a specific customer was charged — which is PII. When we added the
ability to quote service costs (eyebrows €50, hairstyle €90, makeup €110) we
deliberately send these numbers to the model in the system prompt, which looks like
a violation of that story until you see the distinction: a **list price** is the
venue's fixed public menu price for a service *type*, not tied to any customer. It
lives in the static `SERVICES` config alongside each service's duration, is quoted
only on request, and is safe to send precisely because it carries no customer data.
The appointment-price PII stripping is unchanged.
