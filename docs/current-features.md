# Keno — πλήρης λίστα features (ό,τι υπάρχει ήδη)

> Σκοπός: λίστα αναφοράς για να ρωτήσεις άλλο εργαλείο/μοντέλο "τι άλλο να προσθέσουμε" χωρίς να προτείνει κάτι που ήδη υπάρχει.

## Πυρήνας / Feed
- For-You feed με κατηγορίες (Καφές, Μπάλα/Αθλητικά, Διάβασμα, Πάρτι, Πεζοπορία, Πολιτισμός, Εθελοντισμός, Άλλο)
- Toggle For You / Friends, sort βάσει ενδιαφερόντων
- Φίλτρα: ακτίνα, πότε (σήμερα/αύριο/σαββατοκύριακο), μόνο πανεπιστήμιο, solo-friendly
- Feed ποτέ εντελώς άδειο — fallback σε "opening soon" events + admin-pinned flagship event banner
- 5km χάρτης με τα ίδια φίλτρα
- Αναζήτηση events/ατόμων/κοινοτήτων

## Events
- Δημιουργία event με περιορισμούς: ηλικία, πανεπιστήμιο, φύλο (male/female/any), solo-friendly tag
- Ιδιωτικά events + αιτήματα συμμετοχής
- Capacity + waitlist με αυτόματη προαγωγή
- Co-hosts
- Edit event μετά τη δημιουργία
- "Find your group" πληροφορία (κείμενο/φωτό) από τον δημιουργό, εμφανίζεται στο check-in

## Check-in & εισιτήρια
- QR check-in με rotating 30s secret + roll-call fallback (χειροκίνητο)
- Συλλεκτικό Ticket ανά event (unique art, serial number = checkInCount)
- Micro-recap + share-as-image αμέσως μετά το check-in
- Υποχρεωτικό XP staking στη συμμετοχή, κλιμακούμενο στα οικονομικά του χρήστη
- Private reliability score (μη τιμωρητικό) + no-show sweep (scheduled function)
- Stand-in host claim όταν ο δημιουργός δεν εμφανίζεται

## Live Mode (ενεργό event, μετά το check-in)
- Tell-a-friend share
- 🆘 διακριτικό safety button → emergency contact + one-tap 112
- Γρήγορο upload στο photo wall
- "Τερμάτισε το event τώρα" (μόνο δημιουργός)

## Κοινωνικά
- Attendee list με μέτρηση κοινών γνωστών
- Plus-one προσκλήσεις (event ή προφίλ) — XP + Plus One ticket και στους δύο όταν γίνει πραγματικό check-in (όχι μόνο install)
- Follow / DMs — read receipts (Instagram-style "Seen"), push notifications με το πραγματικό περιεχόμενο μηνύματος
- Swipe-to-delete σε DMs, event chats, group chats (με select-all)
- Event chat auto-expire 24h μετά την έναρξη του event
- Kudos reactions σε όσους έκαναν check-in
- Private post-event "πώς ήταν;" feedback για trust του διοργανωτή
- Solo-friendly tag + ticket για πρώτη solo συμμετοχή + welcome ticket πρωτοετών
- Group check-in bonus: 3+ αμοιβαίοι φίλοι check-in στο ίδιο event → Squad ticket + XP

## Photo wall
- Μόνο για όσους έκαναν πραγματικό check-in (όχι lurkers)
- 30-day auto-delete με ειδοποίηση πριν λήξει + δυνατότητα save πριν σβηστεί

## Κοινότητες (Groups)
- Create/join/leave
- Δημόσιες + ιδιωτικές (request-to-join)
- Admin-granted verified-organiser badge
- Dynamic "hero card" expand σε Suggested & My Groups (άγγιγμα → μεγαλώνει η κάρτα)

## Gamification
- XP/levels: Freshman → GOAT (12 επίπεδα) + CEO rung (μόνο για τον ιδρυτή)
- Εβδομαδιαία (όχι ημερήσια) streaks, banked freeze tokens, user-initiated "pause streak" (έως 2/εξάμηνο)
- "Regular" badge (συνέπεια, ξεχωριστό από raw volume)
- "Verified" badge (≥5 check-ins)
- Weekly quests + lifetime challenges (ενοποιημένα σε μία σελίδα "Αποστολές")
- **"Νέος στην πόλη" mode** (νέο): ενεργό μέχρι το πρώτο πραγματικό check-in· badge "ΚΑΙΝΟΥΡΓΙΟΣ" στο προφίλ· μόνο 2 ξεκλείδωτες αποστολές (δημιούργησε event / πήγαινε σε event — βάσει πραγματικού check-in, όχι RSVP), οι υπόλοιπες κλειδωμένες· instant level-up Freshman→Sophomore στο πρώτο event που φτιάχνεις· μεγάλο XP bonus + celebratory οθόνη στο πρώτο check-in, που σε βγάζει από το mode
- **"Έχω κενό" beacon** (νέο): εφήμερο "είμαι ελεύθερος τώρα" σήμα, ορατό σε όλους σε ακτίνα 1χλμ ως ζωντανή κάρτα στο feed (glow/wiggle animation, live countdown)· διάρκεια 30λ/1ώ/2ώ επιλογή χρήστη· tap από άλλον → ανοίγει κατευθείαν DM με context banner + quick-reply· tap στο δικό σου → τερμάτισε νωρίτερα· αυτόματο cleanup

## Κατατάξεις (Leaderboards)
- Split "το πανεπιστήμιό σου" / "όλη η Ελλάδα"
- Μόνο check-ins (ποτέ RSVPs), εβδομαδιαία

## Reviews & reconnect
- Ελαφρύ one-tap "recommend" μεταξύ ατόμων που ήταν μαζί σε event
- Post-event "Θα ξαναβρεθούμε;" mutual-swipe flow → DM αν ταιριάξουν

## Ασφάλεια & moderation
- Reporting σε κάθε profile/event (SLA <24h)
- Bidirectional block
- .gr email verification + ID-photo verification fallback (admin review queue)
- Content-moderation filter σε ελεύθερα πεδία κειμένου
- Party events default verified-only
- Δημιουργός μπορεί να περιορίσει event σε women-only (χωρίς ξεχωριστό feed filter γι' αυτό)

## Ειδοποιήσεις
- Behaviour-triggered (friend-going, referral-reward, κλπ), ποτέ γενικά broadcasts
- Push + in-app, per-category opt-out preferences

## Auth & onboarding
- Progressive sign-up (βήμα-βήμα)
- .gr email verification με custom branded email (Resend)
- ID-photo fallback + pending-verification screen
- Inline sign-in banner όταν λείπει μόνο η ID φωτογραφία

## Settings
- Theme (light/dark), γλώσσα (EL/EN), notification prefs, ενδιαφέροντα, profile visibility, emergency contact, blocked users, feedback/report, legal

## Admin / ops (εσωτερικά, όχι user-facing)
- Events-ingestion pipeline: auto-import events από εξωτερικές πηγές, auto-publish αν δεν χρειάζεται review αλλιώς review queue, ξεχωριστός "keno" λογαριασμός διαχείρισης
- Admin reports queue, audit log, moderation log
