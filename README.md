# F&B Manager

Εφαρμογή διαχείρισης F&B για πολλαπλά καταστήματα εστίασης.

## Modules

- **Καταστήματα**: διαχείριση των σημείων πώλησης
- **Μενού & Συνταγές**: πιάτα, πρώτες ύλες, σύνθεση συνταγών
- **Food Costing**: αυτόματος υπολογισμός κόστους/περιθωρίου ανά πιάτο
- **Απόθεμα**: live απόθεμα ανά κατάστημα, κινήσεις (παραλαβή/φύρα/ανάλωση)
- **Απογραφή**: μηνιαία καταμέτρηση με σύγκριση συστήματος/πραγματικού και ιστορικό
- **Παραγγελίες**: παραγγελίες σε προμηθευτές ανά κατάστημα, αυτόματη ενημέρωση αποθέματος στην παραλαβή
- **Προσωπικό & Βάρδιες**: υπάλληλοι, πρόγραμμα βαρδιών/αδειών/ρεπό, μισθοδοσία με export CSV

## 1. Ρύθμιση Supabase

1. Δημιούργησε νέο project στο https://supabase.com
2. Στο SQL Editor, τρέξε ολόκληρο το περιεχόμενο του αρχείου `supabase_schema.sql`
3. Από Project Settings → API, πάρε το `Project URL` και το `anon public` key

## 2. Τοπική εκτέλεση

```bash
npm install
cp .env.example .env
# συμπλήρωσε VITE_SUPABASE_URL και VITE_SUPABASE_ANON_KEY στο .env
npm run dev
```

## 3. Deploy στο Netlify

1. Ανέβασε τον φάκελο σε GitHub repo
2. Netlify → Add new site → Import from Git
3. Build command: `npm run build`, Publish directory: `dist`
4. Environment variables: πρόσθεσε `VITE_SUPABASE_URL` και `VITE_SUPABASE_ANON_KEY`

Αυτή είναι μια πλήρως ανεξάρτητη web εφαρμογή (React + Supabase) — δεν χρειάζεται το Claude για να τρέχει μετά το deploy.
