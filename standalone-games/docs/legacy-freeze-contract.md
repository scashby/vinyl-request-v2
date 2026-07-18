# Legacy Freeze Contract

This document enforces boundaries while standalone implementation proceeds.

## Non-negotiable rules
- Do not edit legacy Bingo routes, APIs, or tables unless explicitly authorized.
- Do not move or rename existing main-site folders.
- Do not create standalone endpoints in existing src/app/api.

## Allowed implementation surface
- standalone-games/** only

## Stop conditions
- If any unauthorized legacy path is modified, stop and revert that standalone attempt before continuing.
