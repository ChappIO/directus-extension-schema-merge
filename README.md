# Directus CLI Extension: Schema Merge

This extension adds the cli command `schema-merge` to the directus except it uses a modified .yml format which should cause fewer merge conflicts during git merges.

**Note:** This extension is very much under development.
Even though I've tested it, I haven't had it in production for a long time.
And it is touching your database 🤷🏻‍♂️.

## Usage:

1. Install the extension: `npm install directus-extension-schema-sync`.
2. Export your schema: `directus schema-merge snapshot --output schema.yml`:
3. Import your schema `directus schema-merge apply schema.yml`
