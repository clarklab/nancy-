# Critical path

The ordered sequence that takes a player from `START_SCENE`, empty-handed, to the
ending. This document exists because it is the only artifact that *proves* the
game can be finished — `validateContent` can show that nothing is unreachable,
but only a walk shows that the reachable things are enough.

Derived by the progression-integrity pass. Re-walk it after any change to the
scene graph, an act gate, or a puzzle's `onSolve`.

## Steps

ACT I — THE APPRAISAL. Start: the-ardent (START_SCENE), empty-handed, after cinematic cin-opening.

- 1. the-ardent / satchel -> opens puz-fused-commission. Solving grants item commission-s41 and clue-fused-commission. commission-s41 is the key to the strongroom door in Act II, so this is load-bearing, not a tutorial.

- 2. the-ardent / spatula-kit -> items conservation-kit and casebook. The casebook is required by rossport-police/exhibits-schedule and is the citation column the whole endgame is scored on.

- 3. the-ardent / to-slipway -> slipway-and-ritas-shed. (rossport-quay is also open in Act I via to-rossport: phone-money -> ten-pence-pieces, pelagia-memorial -> pelagia-manifest.)

- 4. slipway-and-ritas-shed / cliff-steps -> cliff-path-churchyard / path-to-house -> entrance-hall.

- 5. entrance-hall / visitors-book -> clue-visitors-book (required).

- 6. entrance-hall / to-registry -> registry-counter. slip-lesson -> clue-pp-taught + item order-book-working-copy (read by the puz-three-movements module). olivetti -> specimen-sheets.

- 7. registry-counter / pike-grievance -> clue-docket-fold. COUNTER 3 of 6 for the Board. FIXED THIS PASS: was previously lost forever if the player took a treasury tag from the adjacent hotspot first.

- 8. registry-counter / to-duplicating -> duplicating-room / duplicating-book-1974 -> clue-reprax-1974 (required).

- 9. registry-counter / to-post-room -> post-room. franking-meter -> puz-postmasters-register -> clue-franking-meter (required). address-plates -> clue-schedule-d (required). old-die -> fourpenny-die (required).

- 10. entrance-hall / to-reading-room -> reading-room. coroners-file -> sallow-letter + clue-accident-report (both required). iveson-slip -> clue-iveson-request-slip (required). gazetteer-shelf -> postmark-gazetteer.

- 11. entrance-hall / to-courtyard -> courtyard-and-site-hut / incinerator -> item ash-fragments and opens puz-ash-grate. Solving grants notice-74-119-carbon + clue-scorched-carbon and plays cinematic cin-act-2. (Equivalent route: carry ash-fragments to binding-room/drying-blotters.)

- 12. courtyard-and-site-hut / scaffold-lift -> crowbar + hooded-torch. The crowbar is the Act III gate on puz-tide-room; take it now or on the way back through in Act III.

- 13. registry-counter / to-long-registry -> long-registry / register-notices-1974. With clue-scorched-carbon held this grants clue-issued-register and fires setAct 2. ==== ACT I -> II GATE. Reachable: long-registry is in the Act I closure (entrance-hall -> registry-counter -> long-registry). Prerequisite clue-scorched-carbon is obtainable at courtyard-and-site-hut, also in the Act I closure. ====

ACT II — SERIES 14/B. Player stands in long-registry.

- 14. great-stair / door-rolls-room -> rolls-room / drawers-214-216 -> puz-forty-seven-cards -> item want-list + clue-index-gap (required). Also rolls-room/underwood and wardens-office/imperial-66 and accounts-office/remington for the four specimen sheets.

- 15. wardens-office / w-o-89-2 (now visible, act >= 2) -> memo-wo-89-2 + clue-w-o-89-2 (required).

- 16. great-stair / door-muniment -> muniment-gallery (enterIf act >= 2). time-switch -> flag gallery-lit + clue-gallery-timeswitch (required). spectacles (needs gallery-lit) -> clue-spectacles (required). dust-sample (needs gallery-lit) -> item dust-jar-6.

- 17. long-registry / works-file -> works-order-75188 + clue-works-order-75188 (required). inquiry-transcripts -> clue-sallow-1975-transcript (required).

- 18. long-registry / strongroom-door (visible act >= 2), holding commission-s41 -> opens puz-three-movements. Solving grants clue-order-book-closings and unlocks the strongroom scene.

- 19. Click strongroom-door again -> goto strongroom (enterIf act >= 2 AND puz-three-movements solved).

- 20. strongroom / deed-box -> flimsy-page-two + clue-deed-box-flimsy (required).

- 21. strongroom / bottom-shelf (gated inAct(2,2), i.e. this act only) -> puz-bottom-shelf. Solving grants flimsy-page-two, clue-deed-box-flimsy, plays cin-act-3 and fires advanceTo(3). The vault door is held shut by enabledIf not(all(inAct(2,2), unsolved)) until this is done, so the act turn cannot be walked past. ==== ACT II -> III GATE. Reachable: strongroom is in the Act II closure via long-registry/strongroom-door; the only prerequisite is commission-s41 from Act I step 1. ====

ACT III — THE FORGERY. Player stands in strongroom / long-registry. Note: the-ardent and rossport-quay are NOT reachable this act (Rita will not take the boat out); nothing required is stranded there, since both are reachable again in Acts IV and V.

- 22. binding-room / casebook (act >= 3) -> fibre-loupe, paper-gazetteer, beta-radiograph-sheets.

- 23. courtyard-and-site-hut / to-lamp-room -> lamp-room / deakin-letter -> item deakin-letter + clue-deakin-letter (required). (Alternate source: Rita's Act II dialogue node rit-a2-03, which grants both.)

- 24. binding-room / deakin-bench (visible act >= 3, enabled while holding deakin-letter) -> puz-deakin-authentication -> item adverse-report + clue-deakin-letter + flag deakin-adverse-filed. This is the honest adverse report the act is named for.

- 25. chart-loft / light-table (act >= 3) -> puz-chart-loft -> light-characteristic-note, approach-surveys, clue-light-characteristic (required) and clue-chart-overlays. COUNTER 5 of 6.

- 26. chart-loft / survey-drawer -> approach-surveys and tide-tables-1974. FIXED THIS PASS: the tide tables used to be unobtainable if step 25 was done first. chart-loft / feaver-deposition (needs clue-light-characteristic) -> feaver-timing-note (required). chart-loft / admiralty-list -> admiralty-list-1974 (required).

- 27. courtyard-and-site-hut / to-undercroft -> undercroft / blind-north-wall, holding crowbar and knowing clue-chart-overlays -> puz-tide-room -> marigraph-drum-44, tide-surge-finding, inquiry-working-papers and clue-marigraph-drum. COUNTER 4 of 6.

- 28. undercroft / into-breach -> tide-room. rejects-list -> clue-inquiry-rejects (required). drum-1974-44 -> marigraph-drum-44 if not already held.

- 29. entrance-hall / hook-board (act >= 3) -> strongroom-key (required). tube-head -> revocation-fax.

- 30. accounts-office / munn-claims (visible act >= 3) -> munn-mileage-claims (required). cliff-path-churchyard / along-headland -> brannock-house / nurse-ledger -> clue-nurse-ledger (required); medical-file-box (holding munn-mileage-claims) -> clue-locum-mileage.

- 31. slipway-and-ritas-shed / sallow-boxes (visible act >= 3) -> sallow-r755 + clue-sallow-r755 (required). (Alternate: Rita dialogue node rit-a3-05-third grants both.)

- 32. slipway-and-ritas-shed / causeway-head -> cardew-village. Low water; forty minutes across the tumbled concrete.

- 33. cardew-village / post-office -> flag cardew-frank-checked (the Cardew die last struck 30 September 1972, which is what makes the Deakin letter impossible).

- 34. cardew-village / hill-road -> pikes-cottage.

- 35. pikes-cottage / oil-requisition-book -> item oil-requisition-book + clue-oil-requisition-book (required; also unlocks the two-custody reading of the beacon stores tally in Act IV). despatch-book -> item despatch-book + clue-despatch-docket (required). lights-stores-box -> lamp-report-15aug + clue-lamp-report-15aug (required). ALL THREE ARE NOW RECOVERABLE IN ACT V at pikes-cottage/salvaged-bundles if skipped here.

- 36. pikes-cottage / kitchen-table -> item reconciliation-form, then puz-reconciliation. Solving grants clue-reconciliation (LINK 8 of 8) and clue-franking-shortfall, plays cin-act-4 and fires advanceTo(4). ==== ACT III -> IV GATE. Reachable: pikes-cottage is in the Act III closure via slipway -> causeway-head -> cardew-village -> hill-road. clue-reconciliation is granted by the puzzle's own onSolve, before the act turn in the same effect list, and the skip button resolves as solved — so it is impossible to enter Act IV without LINK 8. ====

ACT IV — PER PROCURATIONEM. Player stands in pikes-cottage. The mainland now closes behind her.

- 37. pikes-cottage / to-village -> cardew-village. telephone-pole -> flag line-down (also set unconditionally by the crossing below, so the roof hatch can never be lost to inattention). garage-fuel-book -> Pike's alibi.

- 38. cardew-village / to-causeway -> slipway-and-ritas-shed. Water over the crown, knee-deep at the third post; it closes behind her. This is the only exit from Act IV's starting position, so line-down is guaranteed set.

- 39. slipway -> cliff-steps -> cliff-path-churchyard -> path-to-house -> entrance-hall / hook-board (act >= 4) -> beacon-padlock-key. Without this the Ardent will not put her alongside the rock.

- 40. registry-counter / stub-book-r982211 (act >= 4) -> slip-r982211 + clue-slip-r982211. LINK 1: presence, 09.10, 14 September 1998. standing-order-7 -> clue-substituted-slips (required).

- 41. courtyard-and-site-hut / site-diary (act >= 4) -> item site-diary + clue-site-diary-rail. LINK 2: means and opportunity, items 41 and 63.

- 42. duplicating-room / duplicating-book-1998 (visible act >= 4) -> clue-reprax-1998. LINK 3: consciousness of guilt, forty-one against twelve. waste-bin -> spoil-sheet.

- 43. wardens-office / board-working-file (visible act >= 4) -> item board-working-file + clue-board-working-file. LINK 4: identity, twenty-six docketed copies.

- 44. accounts-office / ribbon-shelf (act >= 4) -> puz-september-spool -> clue-ribbon-spool. LINK 5: prior knowledge, 12 September 1998.

- 45. muniment-gallery / order-book (visible act >= 4, needs gallery-lit from step 16) -> item order-book-1972-76, opens puz-per-procurationem -> clue-pp-sort (LINK 6: signature, forty-one and seven) and clue-order-book-offsets (required). The same puzzle is also openable at chart-loft/pp-sort-bench, so a player who never lit the gallery is not blocked.

- 46. accounts-office / liabilities-schedule (ungated) -> item liabilities-schedule + clue-liabilities-item14. LINK 7: the hand has a name.

- 47. binding-room / dust-jars, holding dust-jar-6 (step 16) and coroner-exhibit-4 (reading-room/coroners-file, act >= 2) -> dust-comparison + clue-dust-jar-6. COUNTER 2: 'a routine repair'.

- 48. accounts-office / gpo-account (visible act >= 4) -> gpo-trunk-account + clue-gpo-account. COUNTER 6: 'their own book is their word for it'.

- 49. accounts-office / to-switchboard -> switchboard-room / plug-board (act >= 4) -> puz-switchboard -> clue-switchboard-log (required; it is also what turns cardew-village/call-box-4471 into the four-minute no-reply beat).

- 50. reading-room / delivery-hatch (act >= 4) -> commission-minute + clue-commission-minute (required).

- 51. slipway-and-ritas-shed / ardent-mooring (enabled again in act 4) -> the-ardent / to-rossport -> rossport-quay / ferry-office (act >= 4) -> ferry-booking-extract + clue-ferry-booking-book. COUNTER 1: the Board Room alibi. enid-bench -> sundries-memo + clue-sundries-memo (required) + cash-book-1974.

- 52. rossport-quay / to-police -> rossport-police (Iveson, the exhibits schedule, the standard the file has to meet). cliff-path-churchyard / coastguard-row (act >= 4) -> ottolines-cottage -> deferment-letter + clue-deferment-letter.

- 53. chart-loft / to-roof (visible act >= 4, enabled by line-down from step 38) -> pilotage-roof / signal-book -> item signal-book (required), then aldis-lamp -> flag aldis-signalled.

- 54. the-ardent / to-beacon (visible act >= 4, enabled holding beacon-padlock-key) -> beacon-landing (enterIf act >= 4). dry-bag is handed over automatically.

- 55. beacon-landing / jump (needs beacon-padlock-key) -> beacon-oil-store.

- 56. beacon-oil-store / keepers-log -> item keepers-log + clue-keepers-log (required). stores-tally, read while holding oil-requisition-book from step 35, gives the two-custody agreement — this is the examine branch the previous pass flagged, and the requisition book is now recoverable in Act V if it was missed.

- 57. beacon-oil-store / stair-up -> sets flag sea-closed (Rita runs for Cardew with the log) -> beacon-service-room (enterIf act >= 4). Its onEnter fires advanceTo(5) because the keeper's log is held. ==== ACT IV -> V GATE. Reachable: the whole chain from Act IV's starting room is unbroken, and the only hard prerequisites are beacon-padlock-key (step 39, entrance hall) and keepers-log (step 56, same room as the gate). ====

ACT V — THE NINE BELLS. Player stands in beacon-service-room, eleven hours of dark, sea closed.

- 58. beacon-service-room / stove -> flag stove-lit. sabine-confession (needs stove-lit) -> the four-hour confession that is worth nothing. kestrel-satchel (visible act >= 5) -> kestrel-mandate + clue-kestrel-mandate (required). radio -> Iveson: 'bring me an object'.

- 59. beacon-service-room / stair-down -> beacon-oil-store / out-to-landing (enabled in act 5) -> beacon-landing / back-aboard -> the-ardent.

- 60. the-ardent / to-slipway -> slipway-and-ritas-shed / causeway-head. NEW THIS PASS: low water 08.07, the causeway up out of the Sound, smoke standing over Cardew. -> cardew-village / hill-road -> pikes-cottage.

- 61. pikes-cottage / burnt-shell (visible act >= 5) — the Act V art and text the previous pass reported as authored-but-unplayable now plays. pikes-cottage / salvaged-bundles (NEW) -> oil-requisition-book, despatch-book, lamp-report-15aug and their clues if any were missed in Act III, plus clue-reconciliation. This is the recovery path that closes the missable-evidence soft-lock.

- 62. pikes-cottage / to-village -> cardew-village / to-causeway (enabled in act 5) -> slipway -> cliff-steps -> cliff-path-churchyard -> path-to-house -> entrance-hall.

- 63. entrance-hall / to-courtyard -> courtyard-and-site-hut / to-lamp-room -> lamp-room. sector-plates (visible act >= 5) -> item sector-plates. sandbach-crate (act >= 5) -> item fresnel-panel (Sandbach bought one back off a shipping agent at four this morning). Both are required to enable the optic.

- 64. reading-room / wrens-table (act >= 5) -> item case-file. Without it the Board Room case-file hotspot is visible and refuses.

- 65. Optional-but-intended, and it must be done before the Board sits at 14.00: slipway / ardent-mooring -> the-ardent / to-beacon -> beacon-landing / jump -> beacon-oil-store / stair-up -> beacon-service-room / stair-up (visible act >= 5) -> beacon-lantern-room (enterIf act >= 5). optic (enabled holding sector-plates and fresnel-panel) -> puz-the-optic -> flag nine-bells-lit, escapement release set for 23.04. Then back down and ashore the same way.

- 66. great-stair / door-board-room (visible act >= 4) -> board-room (enterIf act >= 4). charter-case -> charter-1811 + clue-charter-art9 (required). certificate (visible act >= 5) -> s41-certificate + flag certificate-signed: series 1/A, 2/C, 9/E and 14/B saved from the pulper on the fourth.

- 67. board-room / case-file (visible act >= 5, enabled holding case-file) -> puz-board-of-dissolution. onSolve grants clue-commission-minute and then branches: all eight links AND all six counters -> flag board-eight-links, cinematic cin-ending-solved, endGame 'ALL EIGHT LINKS STAND'; all eight links only -> board-seven-links, cin-ending-solved, endGame 'THE LINKS STAND; THE REBUTTALS DO NOT ALL FALL'; otherwise -> board-weak-file, cin-ending-wrong, endGame 'THE FILE DOES NOT HOLD'. The game ends here. ==== ENDING. ====

- PROVING-CHAIN AUDIT. Eight links, with the step that supplies each: LINK 1 clue-slip-r982211 (step 40), LINK 2 clue-site-diary-rail (41), LINK 3 clue-reprax-1998 (42), LINK 4 clue-board-working-file (43), LINK 5 clue-ribbon-spool (44), LINK 6 clue-pp-sort (45), LINK 7 clue-liabilities-item14 (46), LINK 8 clue-reconciliation (36). Six counters: clue-ferry-booking-book (51), clue-dust-jar-6 (47), clue-docket-fold (7, FIXED), clue-marigraph-drum (27), clue-chart-overlays (25), clue-gpo-account (48). Every one is granted in a room reachable in the act it is offered in, and every one remains obtainable in Act V — Act V reaches all 34 scenes, and all fourteen grants sit behind gates of the form inAct(n) with no upper bound. Nothing on the proving chain is missable once the four fixes above are in.


## Known limits


- Nothing on the critical path. Two notes for whoever picks this up next, neither of which blocks completion:

- (a) The validator still cannot see item-ordering traps of the kind fixed at steps 7 and 26, because lacksItem is deliberately not counted as a requirement and unprovable conditions evaluate to 'maybe'. I swept the whole graph by script for the pattern 'grant X only while lacking Y, where Y is granted by a different site' and found exactly two live hazards (clue-docket-fold, tide-tables-1974); both are fixed. The remaining hits from that sweep are benign — in every case the alternate source grants the item and its clue together (enid-bench/charnock dialogue, sallow-boxes/rita dialogue, biscuit-tin/verge dialogue, deed-box/puz-bottom-shelf, drum-1974-44/puz-tide-room, the binding-room loupe bundle). A CHECK 5 for this pattern would be a cheap addition to content.ts, which I do not own.

- (b) cardew-village and pikes-cottage keep scene-level weather 'heavy-rain' and ambience 'heavy-storm' in Act V, where the fiction is a flat calm and hard low November sun. weather and ambience are scene properties with no act condition in the schema, so this cannot be expressed as data without an engine change; the Act V layers and narration carry the shift instead. Cosmetic only, and src/ui is owned by the concurrent visual pass.
