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
 * Improved ELO calculation algorithm that handles:
 * - Dynamic K-factor based on score difference and team composition
 * - Skill gap analysis and penalties/bonuses
 * - Aggressive score detection
 * - Balanced vs imbalanced team handling
 * - Stronger team upset penalties and weaker team upset bonuses
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

  // Original complex algorithm for non-beginner matches
  // Get current ELO ratings
  const t1DefElo = team1Defense.elo_defense || 1400;
  const t1OffElo = team1Offense.elo_offense || 1400;
  const t2DefElo = team2Defense.elo_defense || 1400;
  const t2OffElo = team2Offense.elo_offense || 1400;

  // Calculate team ELO using weighted formula
  // Team ELO = weaker_player_elo * 0.9 + stronger_player_elo * 0.1
  const team1WeakerElo = Math.min(t1DefElo, t1OffElo);
  const team1StrongerElo = Math.max(t1DefElo, t1OffElo);
  const team1Avg = team1WeakerElo * 0.9 + team1StrongerElo * 0.1;

  const team2WeakerElo = Math.min(t2DefElo, t2OffElo);
  const team2StrongerElo = Math.max(t2DefElo, t2OffElo);
  const team2Avg = team2WeakerElo * 0.9 + team2StrongerElo * 0.1;

  explanation.push(`Team 1 Weighted ELO: ${Math.round(team1Avg)} (${team1Defense.name}: ${t1DefElo}, ${team1Offense.name}: ${t1OffElo}) - Weaker: ${team1WeakerElo}*0.9 + Stronger: ${team1StrongerElo}*0.1`);
  explanation.push(`Team 2 Weighted ELO: ${Math.round(team2Avg)} (${team2Defense.name}: ${t2DefElo}, ${team2Offense.name}: ${t2OffElo}) - Weaker: ${team2WeakerElo}*0.9 + Stronger: ${team2StrongerElo}*0.1`);

  // Calculate expected scores using standard ELO formula
  const team1Expected = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / 400));
  const team2Expected = 1 - team1Expected;

  explanation.push(`Expected win probability - Team 1: ${Math.round(team1Expected * 100)}%, Team 2: ${Math.round(team2Expected * 100)}%`);

  // Calculate actual scores (normalized)
  const totalScore = team1Score + team2Score;
  const team1Actual = totalScore > 0 ? team1Score / totalScore : 0.5;
  const team2Actual = totalScore > 0 ? team2Score / totalScore : 0.5;

  explanation.push(`Actual score ratio - Team 1: ${Math.round(team1Actual * 100)}%, Team 2: ${Math.round(team2Actual * 100)}%`);

  // Determine if score is aggressive
  const scoreDiff = Math.abs(team1Score - team2Score);
  const isAggressiveScore = scoreDiff >= parameters.aggressiveScoreThreshold;

  if (isAggressiveScore) {
    explanation.push(`🔥 Aggressive score detected! Score difference: ${scoreDiff} (threshold: ${parameters.aggressiveScoreThreshold})`);
  }

  // Analyze team skill composition
  const team1SkillGap = Math.abs(t1DefElo - t1OffElo);
  const team2SkillGap = Math.abs(t2DefElo - t2OffElo);
  const teamEloGap = Math.abs(team1Avg - team2Avg);

  explanation.push(`Team skill gaps - Team 1: ${Math.round(team1SkillGap)}, Team 2: ${Math.round(team2SkillGap)}`);
  explanation.push(`Overall team ELO gap: ${Math.round(teamEloGap)}`);

  // Determine if teams are balanced (both have similar internal skill gaps)
  const bothTeamsBalanced = team1SkillGap < parameters.skillGapThreshold && team2SkillGap < parameters.skillGapThreshold;
  const oneTeamImbalanced = (team1SkillGap >= parameters.skillGapThreshold) !== (team2SkillGap >= parameters.skillGapThreshold);

  if (bothTeamsBalanced) {
    explanation.push(`✅ Both teams are internally balanced (skill gaps < ${parameters.skillGapThreshold})`);
  } else if (oneTeamImbalanced) {
    explanation.push(`⚠️ One team is imbalanced - applying skill gap penalty`);
  } else {
    explanation.push(`⚖️ Both teams are imbalanced - no additional penalty`);
  }

  // Calculate dynamic K-factor based on conditions
  let kFactor = parameters.baseKFactor;

  // Adjust K-factor for score differences - much more dramatic impact
  const scoreDiffImpact = Math.min(scoreDiff * parameters.scoreDiffMultiplier, 3.0); // Cap at 3x multiplier
  kFactor *= (1 + scoreDiffImpact);
  explanation.push(`K-factor adjusted for score difference (${scoreDiff}): ${Math.round(kFactor)}`);

  if (isAggressiveScore) {
    explanation.push(`🔥 Aggressive score detected! Score difference: ${scoreDiff} (threshold: ${parameters.aggressiveScoreThreshold})`);
  }

  // Adjust K-factor for skill gaps
  if (teamEloGap > parameters.skillGapThreshold) {
    if (oneTeamImbalanced) {
      // If one team is imbalanced and there's a skill gap, reduce volatility
      kFactor *= (1 - parameters.skillGapPenalty);
      explanation.push(`K-factor reduced due to skill gap with imbalanced teams: ${Math.round(kFactor)}`);
    } else if (bothTeamsBalanced) {
      // If both teams are balanced but there's a skill gap, increase volatility
      kFactor *= parameters.balancedTeamBonus;
      explanation.push(`K-factor increased for balanced teams with skill gap: ${Math.round(kFactor)}`);
    }
  }

  // Cap the K-factor
  kFactor = Math.min(kFactor, parameters.maxEloChange);
  explanation.push(`Final K-factor (capped): ${Math.round(kFactor)}`);

  // Calculate base ELO changes
  const team1BaseChange = kFactor * (team1Actual - team1Expected);
  const team2BaseChange = kFactor * (team2Actual - team2Expected);

  // Apply additional modifiers for extreme scenarios
  let team1Multiplier = 1;
  let team2Multiplier = 1;

  // Apply aggressive score handicap when weaker team wins aggressively
  if (isAggressiveScore) {
    // Weak team wins convincingly - always apply massive bonus
    if (team1Avg < team2Avg - parameters.skillGapThreshold && team1Score > team2Score) {
      team1Multiplier = 2.5; // Increased from 1.5
      team2Multiplier = 0.5; // Decreased from 0.7
      explanation.push(`🔥 Weaker team (Team 1) won convincingly - massive gain for Team 1, minimal loss for Team 2`);
    } else if (team2Avg < team1Avg - parameters.skillGapThreshold && team2Score > team1Score) {
      team2Multiplier = 2.5; // Increased from 1.5
      team1Multiplier = 0.5; // Decreased from 0.7
      explanation.push(`🔥 Weaker team (Team 2) won convincingly - massive gain for Team 2, minimal loss for Team 1`);
    }

    // Strong team loses badly - only apply if skill gap is reasonable
    else if (teamEloGap <= parameters.skillGapThreshold) {
      if (team1Avg > team2Avg + parameters.skillGapThreshold && team1Score < team2Score) {
        team1Multiplier = 2.0; // Increased from 1.5
        team2Multiplier = 0.6; // Decreased from 0.7
        explanation.push(`🔻 Stronger team (Team 1) lost badly - heavy penalty for Team 1, reduced gain for Team 2`);
      } else if (team2Avg > team1Avg + parameters.skillGapThreshold && team2Score < team1Score) {
        team2Multiplier = 2.0; // Increased from 1.5
        team1Multiplier = 0.6; // Decreased from 0.7
        explanation.push(`🔻 Stronger team (Team 2) lost badly - heavy penalty for Team 2, reduced gain for Team 1`);
      }
    } else {
      explanation.push(`⚖️ Aggressive score detected but skill gap (${Math.round(teamEloGap)}) > threshold (${parameters.skillGapThreshold}) - no upset multipliers for strong team losses`);
    }
  }

  // Calculate final ELO changes
  let team1DefenseChange = Math.round(team1BaseChange * team1Multiplier);
  let team1OffenseChange = Math.round(team1BaseChange * team1Multiplier);
  let team2DefenseChange = Math.round(team2BaseChange * team2Multiplier);
  let team2OffenseChange = Math.round(team2BaseChange * team2Multiplier);

  // ELO CHANGE LIMITS for teams with large skill deficiency (50+ ELO gap)
  if (teamEloGap > parameters.skillGapThreshold) {
    const maxLossForWeaker = 15;
    const maxGainForStronger = 25;

    if (team1Avg < team2Avg) {
      // Team 1 is weaker - limit losses only
      if (team1DefenseChange < -maxLossForWeaker) {
        team1DefenseChange = -maxLossForWeaker;
        team1OffenseChange = -maxLossForWeaker;
        explanation.push(`🛡️ Weaker team (Team 1) loss limited to -${maxLossForWeaker} points`);
      }
      // Team 2 is stronger - limit gains only
      if (team2DefenseChange > maxGainForStronger) {
        team2DefenseChange = maxGainForStronger;
        team2OffenseChange = maxGainForStronger;
        explanation.push(`⚖️ Stronger team (Team 2) gain limited to +${maxGainForStronger} points`);
      }
    } else {
      // Team 2 is weaker - limit losses only
      if (team2DefenseChange < -maxLossForWeaker) {
        team2DefenseChange = -maxLossForWeaker;
        team2OffenseChange = -maxLossForWeaker;
        explanation.push(`🛡️ Weaker team (Team 2) loss limited to -${maxLossForWeaker} points`);
      }
      // Team 1 is stronger - limit gains only
      if (team1DefenseChange > maxGainForStronger) {
        team1DefenseChange = maxGainForStronger;
        team1OffenseChange = maxGainForStronger;
        explanation.push(`⚖️ Stronger team (Team 1) gain limited to +${maxGainForStronger} points`);
      }
    }
  }

  // RULE: Winners never lose points - ensure minimum gain for winning team
  const minWinnerGain = 2;

  if (team1Score > team2Score) {
    // Team 1 won
    if (team1DefenseChange < minWinnerGain) {
      team1DefenseChange = minWinnerGain;
      team1OffenseChange = minWinnerGain;
      explanation.push(`🏆 Winner protection: Team 1 guaranteed minimum +${minWinnerGain} points`);
    }
  } else if (team2Score > team1Score) {
    // Team 2 won
    if (team2DefenseChange < minWinnerGain) {
      team2DefenseChange = minWinnerGain;
      team2OffenseChange = minWinnerGain;
      explanation.push(`🏆 Winner protection: Team 2 guaranteed minimum +${minWinnerGain} points`);
    }
  }
  // For draws, allow negative changes as both teams "didn't win"

  explanation.push(`Final ELO changes:`);
  explanation.push(`Team 1: ${team1DefenseChange > 0 ? '+' : ''}${team1DefenseChange} points each`);
  explanation.push(`Team 2: ${team2DefenseChange > 0 ? '+' : ''}${team2DefenseChange} points each`);

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
