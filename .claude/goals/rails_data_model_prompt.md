We work with providers (e.g. dietitians), their clients, and health journal entries. Set up a Rails
app (or a standalone migrations + models script) with the following:

•Both providers and clients have a name and email address
•Providers have many clients; clients can have more than one provider
•For each provider a client is signed up with, they have one plan - either "basic" or
"premium"
•Clients can post journal entries consisting of freeform text

Include working ActiveRecord queries for:
•All clients for a given provider
•All providers for a given client
•All journal entries for a given client, sorted by date
•All journal entries across all clients of a given provider, sorted by date

Include a README with instructions for running each part locally