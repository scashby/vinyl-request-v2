# Standalone Migration Notes

Files in this folder are standalone-only schema migrations.

Rules:
- Never point these migrations at legacy app tables unless explicitly approved.
- Keep all standalone tables prefixed with sg_ for visibility and safety.
- Add RLS policies with tenant-membership checks for request-path safety.
