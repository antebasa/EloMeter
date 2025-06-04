import type { User, MatchData } from './supabase';

export interface EloParameters {
  baseKFactor: number;
  scoreDiffMultiplier: number;
  skillGapThreshold: number;
  maxEloChange: number;
  aggressiveScoreThreshold: number;
  skillGapPenalty: number;
  balancedTeamBonus: number;
}

export interface EloCalculationResult {
  team1DefenseChange: number;
  team1OffenseChange: number;
  team2DefenseChange: number;
  team2OffenseChange: number;
  explanation: string[];
}

export const DEFAULT_ELO_PARAMETERS: EloParameters = {
  baseKFactor: 60,
  scoreDiffMultiplier: 1.50,
  skillGapThreshold: 50,
  maxEloChange: 150,
  aggressiveScoreThreshold: 8,
  skillGapPenalty: 0.60,
  balancedTeamBonus: 1.50
};

/**
 * Simplified ELO calculation algorithm based on score difference
 * - Fixed ELO changes based on score difference (5, 10, 15, 20, 25, 30, 40, 50, 60, 100)
 * - Team ELO = 0.3 * stronger + 0.7 * weaker
 * - ELO difference protection: divide by 2 if diff > 75 and weaker team loses
 * - Special beginner handling: ±1 for all beginner matches
 */
export function calculateImprovedElo(
  team1Defense: User,
  team1Offense: User,
  team2Defense: User,
  team2Offense: User,
  team1Score: number,
  team2Score: number,
  parameters: EloParameters = DEFAULT_ELO_PARAMETERS
): EloCalculationResult {
  const explanation: string[] = [];

  // Check if any player is a beginner
  const hasBeginners = team1Defense.beginner || team1Offense.beginner || 
                      team2Defense.beginner || team2Offense.beginner;

  if (hasBeginners) {
    explanation.push(`🔰 Beginner match detected! Using simplified scoring: +1 for winners, -1 for losers`);
    
    // Simple beginner scoring: winners get +1, losers get -1, draws get 0
    let team1DefenseChange = 0;
    let team1OffenseChange = 0;
    let team2DefenseChange = 0;
    let team2OffenseChange = 0;

    if (team1Score > team2Score) {
      // Team 1 wins
      team1DefenseChange = 1;
      team1OffenseChange = 1;
      team2DefenseChange = -1;
      team2OffenseChange = -1;
      explanation.push(`Team 1 wins: Team 1 gets +1, Team 2 gets -1`);
    } else if (team2Score > team1Score) {
      // Team 2 wins
      team1DefenseChange = -1;
      team1OffenseChange = -1;
      team2DefenseChange = 1;
      team2OffenseChange = 1;
      explanation.push(`Team 2 wins: Team 2 gets +1, Team 1 gets -1`);
    } else {
      // Draw
      explanation.push(`Draw: No ELO changes for any player`);
    }

    explanation.push(`Final ELO changes:`);
    explanation.push(`${team1Defense.name} (Defense): ${team1DefenseChange > 0 ? '+' : ''}${team1DefenseChange}`);
    explanation.push(`${team1Offense.name} (Offense): ${team1OffenseChange > 0 ? '+' : ''}${team1OffenseChange}`);
    explanation.push(`${team2Defense.name} (Defense): ${team2DefenseChange > 0 ? '+' : ''}${team2DefenseChange}`);
    explanation.push(`${team2Offense.name} (Offense): ${team2OffenseChange > 0 ? '+' : ''}${team2OffenseChange}`);

    return {
      team1DefenseChange,
      team1OffenseChange,
      team2DefenseChange,
      team2OffenseChange,
      explanation
    };
  }

  // Simplified algorithm for regular matches
  // Get current ELO ratings
  const t1DefElo = team1Defense.elo_defense || 1400;
  const t1OffElo = team1Offense.elo_offense || 1400;
  const t2DefElo = team2Defense.elo_defense || 1400;
  const t2OffElo = team2Offense.elo_offense || 1400;

  // Calculate team ELO using new formula: 0.3 * stronger + 0.7 * weaker
  const team1WeakerElo = Math.min(t1DefElo, t1OffElo);
  const team1StrongerElo = Math.max(t1DefElo, t1OffElo);
  const team1Avg = team1StrongerElo * 0.3 + team1WeakerElo * 0.7;

  const team2WeakerElo = Math.min(t2DefElo, t2OffElo);
  const team2StrongerElo = Math.max(t2DefElo, t2OffElo);
  const team2Avg = team2StrongerElo * 0.3 + team2WeakerElo * 0.7;

  explanation.push(`Team 1 ELO: ${Math.round(team1Avg)} (${team1Defense.name}: ${t1DefElo}, ${team1Offense.name}: ${t1OffElo}) - Formula: ${team1StrongerElo}*0.3 + ${team1WeakerElo}*0.7`);
  explanation.push(`Team 2 ELO: ${Math.round(team2Avg)} (${team2Defense.name}: ${t2DefElo}, ${team2Offense.name}: ${t2OffElo}) - Formula: ${team2StrongerElo}*0.3 + ${team2WeakerElo}*0.7`);

  // Calculate score difference
  const scoreDiff = Math.abs(team1Score - team2Score);
  
  // Determine base ELO change based on score difference
  let baseEloChange = 0;
  if (scoreDiff === 1) baseEloChange = 5;
  else if (scoreDiff === 2) baseEloChange = 10;
  else if (scoreDiff === 3) baseEloChange = 15;
  else if (scoreDiff === 4) baseEloChange = 20;
  else if (scoreDiff === 5) baseEloChange = 25;
  else if (scoreDiff === 6) baseEloChange = 30;
  else if (scoreDiff === 7) baseEloChange = 40;
  else if (scoreDiff === 8) baseEloChange = 50;
  else if (scoreDiff === 9) baseEloChange = 60;
  else if (scoreDiff >= 10) baseEloChange = 100;

  explanation.push(`Score difference: ${scoreDiff} → Base ELO change: ±${baseEloChange}`);

  // Check for ELO difference protection
  const teamEloGap = Math.abs(team1Avg - team2Avg);
  let eloChangeMultiplier = 1;
  
  if (teamEloGap > 75) {
    // Check if weaker team lost
    const team1IsWeaker = team1Avg < team2Avg;
    const weakerTeamLost = (team1IsWeaker && team1Score < team2Score) || 
                           (!team1IsWeaker && team2Score < team1Score);
    
    if (weakerTeamLost) {
      eloChangeMultiplier = 0.5;
      explanation.push(`🛡️ ELO protection applied: Team gap ${Math.round(teamEloGap)} > 75 and weaker team lost → ELO change halved`);
    }
  }

  // Calculate final ELO changes
  const finalEloChange = Math.round(baseEloChange * eloChangeMultiplier);
  
  let team1DefenseChange = 0;
  let team1OffenseChange = 0;
  let team2DefenseChange = 0;
  let team2OffenseChange = 0;

  if (team1Score > team2Score) {
    // Team 1 wins
    team1DefenseChange = finalEloChange;
    team1OffenseChange = finalEloChange;
    team2DefenseChange = -finalEloChange;
    team2OffenseChange = -finalEloChange;
    explanation.push(`Team 1 wins by ${scoreDiff}: Team 1 gets +${finalEloChange}, Team 2 gets -${finalEloChange}`);
  } else if (team2Score > team1Score) {
    // Team 2 wins
    team1DefenseChange = -finalEloChange;
    team1OffenseChange = -finalEloChange;
    team2DefenseChange = finalEloChange;
    team2OffenseChange = finalEloChange;
    explanation.push(`Team 2 wins by ${scoreDiff}: Team 2 gets +${finalEloChange}, Team 1 gets -${finalEloChange}`);
  } else {
    // Draw - no ELO changes
    explanation.push(`Draw: No ELO changes for any player`);
  }

  explanation.push(`Final ELO changes:`);
  explanation.push(`${team1Defense.name} (Defense): ${team1DefenseChange > 0 ? '+' : ''}${team1DefenseChange}`);
  explanation.push(`${team1Offense.name} (Offense): ${team1OffenseChange > 0 ? '+' : ''}${team1OffenseChange}`);
  explanation.push(`${team2Defense.name} (Defense): ${team2DefenseChange > 0 ? '+' : ''}${team2DefenseChange}`);
  explanation.push(`${team2Offense.name} (Offense): ${team2OffenseChange > 0 ? '+' : ''}${team2OffenseChange}`);

  return {
    team1DefenseChange,
    team1OffenseChange,
    team2DefenseChange,
    team2OffenseChange,
    explanation
  };
}

/**
 * Helper function to convert MatchData to the format needed for improved ELO calculation
 */
export async function calculateImprovedEloFromMatchData(
  matchData: MatchData,
  userMap: Record<number, User>,
  parameters: EloParameters = DEFAULT_ELO_PARAMETERS
): Promise<EloCalculationResult> {
  const team1Defense = userMap[parseInt(matchData.team1Defense)];
  const team1Offense = userMap[parseInt(matchData.team1Offense)];
  const team2Defense = userMap[parseInt(matchData.team2Defense)];
  const team2Offense = userMap[parseInt(matchData.team2Offense)];

  if (!team1Defense || !team1Offense || !team2Defense || !team2Offense) {
    throw new Error('One or more players not found in user map');
  }

  return calculateImprovedElo(
    team1Defense,
    team1Offense,
    team2Defense,
    team2Offense,
    matchData.team1Score,
    matchData.team2Score,
    parameters
  );
}
