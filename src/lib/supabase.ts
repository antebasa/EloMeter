import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qhsguodtwbqqqfxgtups.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2d1b2R0d2JxcXFmeGd0dXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1MDMsImV4cCI6MjA2MjgxMDUwM30.GiJCjG3JhBxknz8AqP2csfDdkjdAf0nyekjVJKP3xD8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Constants from Python's elo_tracker.py
const DEFAULT_ELO = 1400;
const K_FACTOR = 80; // Higher than standard 32 for more volatility as in the Python script
const SCORE_DIFF_MULTIPLIER = 0.15; // From Python script

export interface User {
  id: number;
  name: string;
  email?: string;
  created_at?: string;
  goals?: number;
  conceded?: number;
  wins?: number;
  losses?: number;
  played?: number;
  elo_offense?: number;
  elo_defense?: number;
}

export enum TeamColor {
  BLUE = 'blue',
  WHITE = 'white'
}

export interface MatchData {
  team1Defense: string; // user_id
  team1Offense: string; // user_id
  team2Defense: string; // user_id
  team2Offense: string; // user_id
  team1Score: number;
  team2Score: number;
  team1DefenseGoals?: number; // Optional goals scored by team1 defense player
  team1OffenseGoals?: number; // Optional goals scored by team1 offense player
  team2DefenseGoals?: number; // Optional goals scored by team2 defense player
  team2OffenseGoals?: number; // Optional goals scored by team2 offense player
}

// Function to get all users
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

// Python script's ELO calculation functions

// Calculate the expected score based on ELO ratings
function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

// Update ELO rating based on expected and actual scores
function updateElo(playerElo: number, expectedScore: number, actualScore: number, scoreDiff: number | null = null): number {
  let baseChange = K_FACTOR * (actualScore - expectedScore);

  // Add score difference impact for more dynamic changes
  if (scoreDiff !== null) {
    const scoreImpact = Math.min(Math.abs(scoreDiff) * SCORE_DIFF_MULTIPLIER, 1.0);
    baseChange *= (1 + scoreImpact);
  }

  return playerElo + baseChange;
}

// Save match data to Supabase
export async function saveMatch(matchData: MatchData): Promise<{ success: boolean; error?: any }> {
  try {
    // Get current user data to have their ELO scores
    const { data: users, error: getUsersError } = await supabase
      .from('User')
      .select('id, elo_offense, elo_defense, goals, conceded, wins, losses, played')
      .in('id', [
        parseInt(matchData.team1Defense),
        parseInt(matchData.team1Offense),
        parseInt(matchData.team2Defense),
        parseInt(matchData.team2Offense)
      ]);

    if (getUsersError || !users) {
      console.error('Error fetching user data:', getUsersError);
      return { success: false, error: getUsersError };
    }

    // Create user lookup object for easier access
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<number, any>);

    // Get player IDs
    const team1DefenseId = parseInt(matchData.team1Defense);
    const team1OffenseId = parseInt(matchData.team1Offense);
    const team2DefenseId = parseInt(matchData.team2Defense);
    const team2OffenseId = parseInt(matchData.team2Offense);

    // Get player ELOs
    const team1DefenseDefElo = userMap[team1DefenseId]?.elo_defense || DEFAULT_ELO;
    const team1OffenseOffElo = userMap[team1OffenseId]?.elo_offense || DEFAULT_ELO;
    const team2DefenseDefElo = userMap[team2DefenseId]?.elo_defense || DEFAULT_ELO;
    const team2OffenseOffElo = userMap[team2OffenseId]?.elo_offense || DEFAULT_ELO;

    // Calculate team ELOs (average of defense_elo and offense_elo for respective players)
    const team1Elo = (team1DefenseDefElo + team1OffenseOffElo) / 2;
    const team2Elo = (team2DefenseDefElo + team2OffenseOffElo) / 2;

    // Calculate expected scores
    const team1Expected = calculateExpectedScore(team1Elo, team2Elo);
    const team2Expected = 1 - team1Expected;

    // Calculate actual scores (normalized to sum to 1)
    const totalScore = matchData.team1Score + matchData.team2Score;
    const team1Actual = matchData.team1Score / totalScore;
    const team2Actual = matchData.team2Score / totalScore;

    // Calculate score difference
    const scoreDiff = matchData.team1Score - matchData.team2Score;

    // Update ELO ratings with score difference impact
    const newTeam1DefenseDefElo = Math.round(updateElo(team1DefenseDefElo, team1Expected, team1Actual, scoreDiff));
    const newTeam1OffenseOffElo = Math.round(updateElo(team1OffenseOffElo, team1Expected, team1Actual, scoreDiff));
    const newTeam2DefenseDefElo = Math.round(updateElo(team2DefenseDefElo, team2Expected, team2Actual, -scoreDiff));
    const newTeam2OffenseOffElo = Math.round(updateElo(team2OffenseOffElo, team2Expected, team2Actual, -scoreDiff));

    // Determine the winner
    const team1Won = matchData.team1Score > matchData.team2Score;

    // 1. Insert new Match
    const { data: matchInsertData, error: matchInsertError } = await supabase
      .from('Match')
      .insert({
        team_white_score: matchData.team1Score,
        team_blue_score: matchData.team2Score,
        created_at: new Date()
      })
      .select('id')
      .single();

    if (matchInsertError || !matchInsertData) {
      console.error('Error inserting match:', matchInsertError);
      return { success: false, error: matchInsertError };
    }

    const matchId = matchInsertData.id;

    // 2. Insert WHITE team
    const { data: team1Data, error: team1Error } = await supabase
      .from('Team')
      .insert({
        match_id: matchId,
        color: TeamColor.BLUE,
        created_at: new Date()
      })
      .select('id')
      .single();

    if (team1Error || !team1Data) {
      console.error('Error inserting team 1:', team1Error);
      return { success: false, error: team1Error };
    }

    // 3. Insert BLUE team
    const { data: team2Data, error: team2Error } = await supabase
      .from('Team')
      .insert({
        match_id: matchId,
        color: TeamColor.WHITE,
        created_at: new Date()
      })
      .select('id')
      .single();

    if (team2Error || !team2Data) {
      console.error('Error inserting team 2:', team2Error);
      return { success: false, error: team2Error };
    }

    // 4. Insert Team Players - both players on the same team get the same goals
    const teamPlayersData = [
      // White team - Defense
      {
        team_id: team1Data.id,
        user_id: team1DefenseId,
        scored: matchData.team1Score, // Same score for both team players
        conceded: matchData.team2Score,
        old_elo: team1DefenseDefElo,
        new_elo: newTeam1DefenseDefElo,
        created_at: new Date()
      },
      // White team - Offense
      {
        team_id: team1Data.id,
        user_id: team1OffenseId,
        scored: matchData.team1Score, // Same score for both team players
        conceded: matchData.team2Score,
        old_elo: team1OffenseOffElo,
        new_elo: newTeam1OffenseOffElo,
        created_at: new Date()
      },
      // Blue team - Defense
      {
        team_id: team2Data.id,
        user_id: team2DefenseId,
        scored: matchData.team2Score, // Same score for both team players
        conceded: matchData.team1Score,
        old_elo: team2DefenseDefElo,
        new_elo: newTeam2DefenseDefElo,
        created_at: new Date()
      },
      // Blue team - Offense
      {
        team_id: team2Data.id,
        user_id: team2OffenseId,
        scored: matchData.team2Score, // Same score for both team players
        conceded: matchData.team1Score,
        old_elo: team2OffenseOffElo,
        new_elo: newTeam2OffenseOffElo,
        created_at: new Date()
      }
    ];

    const { error: teamPlayersError } = await supabase
      .from('TeamPlayer')
      .insert(teamPlayersData);

    if (teamPlayersError) {
      console.error('Error inserting team players:', teamPlayersError);
      return { success: false, error: teamPlayersError };
    }

    // 5. Update User stats
    const updateUser1Defense = {
      elo_defense: newTeam1DefenseDefElo,
      goals: (userMap[team1DefenseId]?.goals || 0) + matchData.team1Score, // Full team score
      conceded: (userMap[team1DefenseId]?.conceded || 0) + matchData.team2Score,
      wins: (userMap[team1DefenseId]?.wins || 0) + (team1Won ? 1 : 0),
      losses: (userMap[team1DefenseId]?.losses || 0) + (team1Won ? 0 : 1),
      played: (userMap[team1DefenseId]?.played || 0) + 1
    };

    const updateUser1Offense = {
      elo_offense: newTeam1OffenseOffElo,
      goals: (userMap[team1OffenseId]?.goals || 0) + matchData.team1Score, // Full team score
      conceded: (userMap[team1OffenseId]?.conceded || 0) + matchData.team2Score,
      wins: (userMap[team1OffenseId]?.wins || 0) + (team1Won ? 1 : 0),
      losses: (userMap[team1OffenseId]?.losses || 0) + (team1Won ? 0 : 1),
      played: (userMap[team1OffenseId]?.played || 0) + 1
    };

    const updateUser2Defense = {
      elo_defense: newTeam2DefenseDefElo,
      goals: (userMap[team2DefenseId]?.goals || 0) + matchData.team2Score, // Full team score
      conceded: (userMap[team2DefenseId]?.conceded || 0) + matchData.team1Score,
      wins: (userMap[team2DefenseId]?.wins || 0) + (team1Won ? 0 : 1),
      losses: (userMap[team2DefenseId]?.losses || 0) + (team1Won ? 1 : 0),
      played: (userMap[team2DefenseId]?.played || 0) + 1
    };

    const updateUser2Offense = {
      elo_offense: newTeam2OffenseOffElo,
      goals: (userMap[team2OffenseId]?.goals || 0) + matchData.team2Score, // Full team score
      conceded: (userMap[team2OffenseId]?.conceded || 0) + matchData.team1Score,
      wins: (userMap[team2OffenseId]?.wins || 0) + (team1Won ? 0 : 1),
      losses: (userMap[team2OffenseId]?.losses || 0) + (team1Won ? 1 : 0),
      played: (userMap[team2OffenseId]?.played || 0) + 1
    };

    // Update users in parallel
    await Promise.all([
      supabase.from('User').update(updateUser1Defense).eq('id', team1DefenseId),
      supabase.from('User').update(updateUser1Offense).eq('id', team1OffenseId),
      supabase.from('User').update(updateUser2Defense).eq('id', team2DefenseId),
      supabase.from('User').update(updateUser2Offense).eq('id', team2OffenseId)
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error saving match:', error);
    return { success: false, error };
  }
}

// Function to get a player's match history
export async function getPlayerMatchHistory(userId: number): Promise<any[]> {
  // First get all the teams the player was part of
  const { data: teamPlayers, error: teamPlayersError } = await supabase
    .from('TeamPlayer')
    .select('id, team_id, old_elo, new_elo, scored, conceded, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (teamPlayersError || !teamPlayers) {
    console.error('Error fetching team players:', teamPlayersError);
    return [];
  }

  // If there are no matches, return empty array
  if (teamPlayers.length === 0) {
    return [];
  }

  // Get the teams
  const teamIds = teamPlayers.map(tp => tp.team_id);
  const { data: teams, error: teamsError } = await supabase
    .from('Team')
    .select('id, match_id, color')
    .in('id', teamIds);

  if (teamsError || !teams) {
    console.error('Error fetching teams:', teamsError);
    return [];
  }

  // Create a lookup for teams
  const teamMap = teams.reduce((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {} as Record<number, any>);

  // Get the matches
  const matchIds = teams.map(team => team.match_id);
  const { data: matches, error: matchesError } = await supabase
    .from('Match')
    .select('id, team_white_score, team_blue_score, created_at')
    .in('id', matchIds);

  if (matchesError || !matches) {
    console.error('Error fetching matches:', matchesError);
    return [];
  }

  // Create a lookup for matches
  const matchMap = matches.reduce((acc, match) => {
    acc[match.id] = match;
    return acc;
  }, {} as Record<number, any>);

  // Get all team players for the matches to find teammates and opponents
  const { data: allTeamPlayers, error: allTeamPlayersError } = await supabase
    .from('TeamPlayer')
    .select('id, team_id, user_id')
    .in('team_id', teamIds);

  if (allTeamPlayersError || !allTeamPlayers) {
    console.error('Error fetching all team players:', allTeamPlayersError);
    return [];
  }

  // Get all users
  const userIds = allTeamPlayers.map(tp => tp.user_id);
  const { data: users, error: usersError } = await supabase
    .from('User')
    .select('id, name')
    .in('id', userIds);

  if (usersError || !users) {
    console.error('Error fetching users:', usersError);
    return [];
  }

  // Create a lookup for users
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<number, any>);

  // Map team players to match history with detailed information
  return teamPlayers.map(tp => {
    const team = teamMap[tp.team_id];
    const match = matchMap[team.match_id];

    // Determine teammates and opponents
    const teamPlayers = allTeamPlayers.filter(player => player.team_id === tp.team_id);
    const teammatePlayer = teamPlayers.find(player => player.user_id !== userId);
    const teammate = teammatePlayer ? userMap[teammatePlayer.user_id] : null;

    const opposingTeamPlayers = allTeamPlayers.filter(player =>
      player.team_id !== tp.team_id && teamMap[player.team_id]?.match_id === team.match_id
    );

    const opponents = opposingTeamPlayers.map(player => userMap[player.user_id]);

    // Determine match outcome
    const isTeamBlue = team.color === TeamColor.BLUE;
    const teamScore = isTeamBlue ? match.team_blue_score : match.team_white_score;
    const opponentScore = isTeamBlue ? match.team_white_score : match.team_blue_score;
    const won = teamScore > opponentScore;

    return {
      id: tp.id,
      date: match.created_at,
      result: won ? 'Win' : teamScore === opponentScore ? 'Draw' : 'Loss',
      score: `${teamScore}-${opponentScore}`,
      eloChange: tp.new_elo - tp.old_elo,
      oldElo: tp.old_elo,
      newElo: tp.new_elo,
      scored: tp.scored,
      conceded: tp.conceded,
      teammate: teammate ? teammate.name : 'Unknown',
      opponents: opponents.map(o => o ? o.name : 'Unknown').join(' & ')
    };
  });
}

// Function to get a player's Elo history
export async function getPlayerEloHistory(userId: number): Promise<any[]> {
  const { data: teamPlayers, error: teamPlayersError } = await supabase
    .from('TeamPlayer')
    .select('id, team_id, old_elo, new_elo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (teamPlayersError || !teamPlayers) {
    console.error('Error fetching team players for Elo history:', teamPlayersError);
    return [];
  }

  // If no matches, return an array with just the initial Elo
  if (teamPlayers.length === 0) {
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('elo_offense, elo_defense')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user for Elo history:', userError);
      return [];
    }

    const now = new Date().toISOString();
    return [
      {
        x: now,
        y: user.elo_offense || DEFAULT_ELO,
        id: 'initial',
        type: 'offense'
      },
      {
        x: now,
        y: user.elo_defense || DEFAULT_ELO,
        id: 'initial',
        type: 'defense'
      }
    ];
  }

  // Get the user to determine if the Elo is for offense or defense
  const { data: user, error: userError } = await supabase
    .from('User')
    .select('elo_offense, elo_defense')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('Error fetching user for Elo history:', userError);
    return [];
  }

  // Get team information to determine player position
  const teamIds = teamPlayers.map(tp => tp.team_id);
  const { data: teamPlayerPositions, error: positionsError } = await supabase
    .from('TeamPlayer')
    .select('id, team_id, position')
    .eq('user_id', userId)
    .in('team_id', teamIds);

  if (positionsError || !teamPlayerPositions) {
    console.error('Error fetching team player positions:', positionsError);
    return [];
  }

  // Create a lookup for positions
  const positionMap = teamPlayerPositions.reduce((acc, tp) => {
    acc[tp.id] = tp.position;
    return acc;
  }, {} as Record<number, string>);

  // Create two separate series for offense and defense
  const offenseData: any[] = [];
  const defenseData: any[] = [];

  // Add initial point with starting Elo
  const firstMatch = new Date(teamPlayers[0].created_at);
  const oneWeekBefore = new Date(firstMatch);
  oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

  offenseData.push({
    x: oneWeekBefore.toISOString(),
    y: DEFAULT_ELO,  // Default starting Elo
    id: 'initial',
    type: 'offense'
  });

  defenseData.push({
    x: oneWeekBefore.toISOString(),
    y: DEFAULT_ELO,  // Default starting Elo
    id: 'initial',
    type: 'defense'
  });

  // Map history to data points
  teamPlayers.forEach(tp => {
    const position = positionMap[tp.id] || 'unknown';
    const isOffense = position === 'offense'; // Assume 'offense' and 'defense' as positions

    const dataPoint = {
      x: tp.created_at,
      y: tp.new_elo,
      id: tp.id,
      type: isOffense ? 'offense' : 'defense'
    };

    if (isOffense) {
      offenseData.push(dataPoint);
    } else {
      defenseData.push(dataPoint);
    }
  });

  // Add current Elo as last point
  const now = new Date().toISOString();

  offenseData.push({
    x: now,
    y: user.elo_offense || DEFAULT_ELO,
    id: 'current',
    type: 'offense'
  });

  defenseData.push({
    x: now,
    y: user.elo_defense || DEFAULT_ELO,
    id: 'current',
    type: 'defense'
  });

  // Combine both series
  return [...offenseData, ...defenseData];
}
