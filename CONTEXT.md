# Treatwell Availability Chat

A single-practitioner, single-venue chat assistant that answers natural-language
questions about a Treatwell calendar. Read-only: it never creates, changes, or
cancels bookings.

## Language

**Service**:
One of the fixed treatment types the venue offers (eyebrows, hairstyle, makeup).
Each has a treatment duration and a list price. The MVP uses a hardcoded map, not
Treatwell's real offer catalog.

**List price**:
The fixed EUR amount a service type costs, part of the venue's public menu. Static
config, analogous to a service's duration. Safe to quote to the customer.
_Avoid_: price (ambiguous), catalog price, service price.

**Appointment price**:
What a specific customer was charged for a booking. Customer PII — stripped at the
Treatwell boundary and never sent to the language model. Distinct from a **List price**.
_Avoid_: price (ambiguous).

**Busy interval**:
A `{ date, start, end }` block of occupied time, reduced from a Treatwell appointment
or personal block with all customer PII dropped. The only calendar data the availability
computation sees.

**Free slot**:
A start time on the 15-minute grid, within working hours, where the full service
duration fits before the next busy interval and which is not in the past.
