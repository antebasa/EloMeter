-- User ELO Updates using Improved Algorithm
-- Generated automatically - review before executing

BEGIN;

UPDATE public."User" 
SET elo_defense = 1389, 
    elo_offense = 1632
WHERE id = 1;
UPDATE public."User" 
SET elo_defense = 1545, 
    elo_offense = 1334
WHERE id = 7;
UPDATE public."User" 
SET elo_defense = 1392, 
    elo_offense = 1305
WHERE id = 8;
UPDATE public."User" 
SET elo_defense = 1464, 
    elo_offense = 1409
WHERE id = 9;
UPDATE public."User" 
SET elo_defense = 1516, 
    elo_offense = 1424
WHERE id = 10;
UPDATE public."User" 
SET elo_defense = 1362, 
    elo_offense = 1339
WHERE id = 11;
UPDATE public."User" 
SET elo_defense = 1429, 
    elo_offense = 1625
WHERE id = 12;
UPDATE public."User" 
SET elo_defense = 1186, 
    elo_offense = 1119
WHERE id = 17;
UPDATE public."User" 
SET elo_defense = 1015, 
    elo_offense = 1000
WHERE id = 18;
UPDATE public."User" 
SET elo_defense = 1001, 
    elo_offense = 1081
WHERE id = 24;
UPDATE public."User" 
SET elo_defense = 988, 
    elo_offense = 1019
WHERE id = 25;

COMMIT;
