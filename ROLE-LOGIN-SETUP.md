# Corrected email and role login

Open THIS extracted creative-adhyayan folder in VS Code. Run in its terminal:

    npm ci
    npm run dev

Stop the previous Vite server first (Ctrl+C). Use the URL printed by this terminal.
Do not copy only Login.tsx: the workspace store, profile parser and routes were fixed together.

## Firebase setup

Use the existing nick-9dbb0 Firebase project. Enable Email/Password and optionally Google
in Authentication. Create the user in Authentication, then create users/{Authentication UID}
in Firestore with name, email and role fields. Passwords belong only in Authentication.

Accepted role strings:
- director -> /director
- manager -> /manager
- team_lead or team_leader -> /team-lead
- employee -> /employee

Optional fields: active (boolean, false disables workspace access), team_id (string),
reports_to (supervisor's Authentication UID).

Missing profiles or invalid roles cannot enter a dashboard. The app listens to the profile
so role changes also update an open session. It never assigns a default Director role.

The included firestore.rules allows a signed-in user to read their own profile and prevents
browser users from changing roles. Review/publish this in Firebase Console > Firestore > Rules.
If you have other collections with existing rules, merge this users rule with those rules.
Do not leave a broad overlapping allow-write rule that permits users to edit their roles.

## What this repair does not change

Task/project/People records still use the original browser-local storage and sample data.
Adding a People record does not create a Firebase Authentication account or assign its login role.
Use Firebase Console for login accounts and role assignment. This is not a shared cloud task database.

## Verification

    npm run build
    npm test

If VS Code shows JSX errors, run npm ci inside this folder, then use
TypeScript: Restart TS Server. Save React code as .tsx. For any remaining error,
copy its exact text from the Problems panel.

Live login still requires valid credentials and deployed Firestore rules; these cannot be
verified by an offline build. Dashboard route guards are UI access checks; Firestore rules
enforce profile access on the server.
