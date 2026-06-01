# Checklist Florian — avant le 3 juin

## 1er juin (aujourd'hui)

- [ ] **Compte Fabienne** : abonnement Agiloshield Classic / essai actif dans Memberstack
- [ ] **Test webapp** avec un compte test ou le sien : login → `/tools/anonymisation` → mode **Pseudonymiser** → PER/ORG/ADR/IDN → upload DOCX → download OK
- [ ] **Assembler le kit** : `cd Demo_Fabienne_3juin && ./assemble_kit.sh`
- [ ] **Vérifier** fichiers dans `fichiers/` (original, pseudonymisé, .properties)
- [ ] **Tester Claude** : upload `02_pseudonymise_…docx` + prompt 1 de `PROMPTS_CLAUDE_DEMO.md`
- [ ] **Envoyer email** Fabienne (`EMAIL_FABIENNE_1JUIN.md`) + pièces : guide HTML + kit zip si Drive
- [ ] **Message Nicolas** (`MESSAGE_NICOLAS_MINIMAL.md`) — mot de passe app Fabienne (option skill)

## 2 juin — call Fabienne (20 min)

- [ ] Elle se connecte seule sur agiloshield.com
- [ ] Elle pseudonymise **un de ses documents** (ou le demo si confidentialité)
- [ ] Elle upload le résultat dans Claude et pose 1 question M&A
- [ ] Corriger si mode Anonymiser au lieu de Pseudonymiser
- [ ] Confirmer qu'elle a le script associés (`SCRIPT_DEMO_ASSOCIES_3MIN.md`)
- [ ] Rappeler Plan B : fichier pré-pseudonymisé dans le kit

## 3–4 juin — jour J (support léger)

- [ ] Être joignable 30 min avant sa réunion (WhatsApp / tel)
- [ ] Ne pas promettre skill Claude live sauf mot de passe app reçu de Nicolas
- [ ] Post-réunion : feedback + proposition essai réseau Eurallia si positive

## Liens rapides

| Ressource | URL |
|-----------|-----|
| Outil | https://www.agilotext.com/tools/anonymisation |
| Calendly | https://calendly.com/florian-bauer-agilotext/30min?month=2026-06 |
| Kit local | `Campagne_Agiloshield_2026/Demo_Fabienne_3juin/` |
| Demo source | `Agilotext-MCP/examples/bilan-ma-demo-fabienne.docx` |

## Si ça casse le jour J

1. Plan B : fichier `02_pseudonymise_…docx` du kit  
2. Plan C : montrer capture écran webapp + Claude sur fichier préparé  
3. Ne pas improviser MCP / terminal / token console
