import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qhsguodtwbqqqfxgtups.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2d1b2R0d2JxcXFmeGd0dXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1MDMsImV4cCI6MjA2MjgxMDUwM30.GiJCjG3JhBxknz8AqP2csfDdkjdAf0nyekjVJKP3xD8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  elo_score?: number;
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
}

// Function to insert 10 sample users if they don't exist
export async function insertSampleUsers() {
  const sampleUsers = [
    { name: 'John Doe', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Jane Smith', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Michael Johnson', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Emily Davis', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Robert Wilson', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Sarah Brown', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'David Miller', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Jennifer Taylor', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'James Anderson', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 },
    { name: 'Lisa Thomas', elo_score: 1500, played: 0, wins: 0, losses: 0, goals: 0, conceded: 0 }
  ];

  // Check if users already exist
  const { data: existingUsers } = await supabase
    .from('User')
    .select('*')
    .limit(1);

  // If no users exist, insert sample users
  if (!existingUsers || existingUsers.length === 0) {
    await supabase.from('User').insert(sampleUsers);
  }
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

// Calculate new ELO ratings based on match results
export function calculateEloChange(
  player1Elo: number,
  player2Elo: number,
  player1Won: boolean,
  kFactor = 32
): { newPlayer1Elo: number, newPlayer2Elo: number } {
  const expectedScore1 = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400));
  const actualScore1 = player1Won ? 1 : 0;
  const actualScore2 = player1Won ? 0 : 1;

  const eloChange = Math.round(kFactor * (actualScore1 - expectedScore1));

  return {
    newPlayer1Elo: player1Elo + eloChange,
    newPlayer2Elo: player2Elo - eloChange
  };
}

// Calculate average team ELO
function calculateTeamElo(player1Elo: number, player2Elo: number): number {
  return Math.round((player1Elo + player2Elo) / 2);
}

// Save match data to Supabase
export async function saveMatch(matchData: MatchData): Promise<{ success: boolean; error?: any }> {
  try {
    // Get current user data to have their ELO scores
    const { data: users, error: getUsersError } = await supabase
      .from('User')
      .select('id, elo_score, goals, conceded, wins, losses, played')
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

    // Determine the winner
    const team1Won = matchData.team1Score > matchData.team2Score;

    // Get player ELOs
    const team1DefenseId = parseInt(matchData.team1Defense);
    const team1OffenseId = parseInt(matchData.team1Offense);
    const team2DefenseId = parseInt(matchData.team2Defense);
    const team2OffenseId = parseInt(matchData.team2Offense);

    const team1DefenseElo = userMap[team1DefenseId]?.elo_score || 1500;
    const team1OffenseElo = userMap[team1OffenseId]?.elo_score || 1500;
    const team2DefenseElo = userMap[team2DefenseId]?.elo_score || 1500;
    const team2OffenseElo = userMap[team2OffenseId]?.elo_score || 1500;

    // Calculate team ELOs (average of both players)
    const team1Elo = calculateTeamElo(team1DefenseElo, team1OffenseElo);
    const team2Elo = calculateTeamElo(team2DefenseElo, team2OffenseElo);

    // Calculate new ELOs based on result
    const { newPlayer1Elo: newTeam1Elo, newPlayer2Elo: newTeam2Elo } =
      calculateEloChange(team1Elo, team2Elo, team1Won);

    // Calculate individual ELO changes (divide equally among team members)
    const team1EloChange = newTeam1Elo - team1Elo;
    const team2EloChange = newTeam2Elo - team2Elo;

    const newTeam1DefenseElo = team1DefenseElo + team1EloChange;
    const newTeam1OffenseElo = team1OffenseElo + team1EloChange;
    const newTeam2DefenseElo = team2DefenseElo + team2EloChange;
    const newTeam2OffenseElo = team2OffenseElo + team2EloChange;

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
        color: TeamColor.WHITE,
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
        color: TeamColor.BLUE,
        created_at: new Date()
      })
      .select('id')
      .single();

    if (team2Error || !team2Data) {
      console.error('Error inserting team 2:', team2Error);
      return { success: false, error: team2Error };
    }

    // 4. Insert Team Players
    const teamPlayersData = [
      // White team - Defense
      {
        team_id: team1Data.id,
        user_id: team1DefenseId,
        scored: Math.floor(matchData.team1Score / 2), // Split goals evenly, this is an approximation
        conceded: matchData.team2Score,
        old_elo: team1DefenseElo,
        new_elo: newTeam1DefenseElo,
        created_at: new Date()
      },
      // White team - Offense
      {
        team_id: team1Data.id,
        user_id: team1OffenseId,
        scored: Math.ceil(matchData.team1Score / 2), // Split goals evenly, give extra to offense
        conceded: matchData.team2Score,
        old_elo: team1OffenseElo,
        new_elo: newTeam1OffenseElo,
        created_at: new Date()
      },
      // Blue team - Defense
      {
        team_id: team2Data.id,
        user_id: team2DefenseId,
        scored: Math.floor(matchData.team2Score / 2), // Split goals evenly
        conceded: matchData.team1Score,
        old_elo: team2DefenseElo,
        new_elo: newTeam2DefenseElo,
        created_at: new Date()
      },
      // Blue team - Offense
      {
        team_id: team2Data.id,
        user_id: team2OffenseId,
        scored: Math.ceil(matchData.team2Score / 2), // Split goals evenly, give extra to offense
        conceded: matchData.team1Score,
        old_elo: team2OffenseElo,
        new_elo: newTeam2OffenseElo,
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
      elo_score: newTeam1DefenseElo,
      goals: (userMap[team1DefenseId]?.goals || 0) + Math.floor(matchData.team1Score / 2),
      conceded: (userMap[team1DefenseId]?.conceded || 0) + matchData.team2Score,
      wins: (userMap[team1DefenseId]?.wins || 0) + (team1Won ? 1 : 0),
      losses: (userMap[team1DefenseId]?.losses || 0) + (team1Won ? 0 : 1),
      played: (userMap[team1DefenseId]?.played || 0) + 1
    };

    const updateUser1Offense = {
      elo_score: newTeam1OffenseElo,
      goals: (userMap[team1OffenseId]?.goals || 0) + Math.ceil(matchData.team1Score / 2),
      conceded: (userMap[team1OffenseId]?.conceded || 0) + matchData.team2Score,
      wins: (userMap[team1OffenseId]?.wins || 0) + (team1Won ? 1 : 0),
      losses: (userMap[team1OffenseId]?.losses || 0) + (team1Won ? 0 : 1),
      played: (userMap[team1OffenseId]?.played || 0) + 1
    };

    const updateUser2Defense = {
      elo_score: newTeam2DefenseElo,
      goals: (userMap[team2DefenseId]?.goals || 0) + Math.floor(matchData.team2Score / 2),
      conceded: (userMap[team2DefenseId]?.conceded || 0) + matchData.team1Score,
      wins: (userMap[team2DefenseId]?.wins || 0) + (team1Won ? 0 : 1),
      losses: (userMap[team2DefenseId]?.losses || 0) + (team1Won ? 1 : 0),
      played: (userMap[team2DefenseId]?.played || 0) + 1
    };

    const updateUser2Offense = {
      elo_score: newTeam2OffenseElo,
      goals: (userMap[team2OffenseId]?.goals || 0) + Math.ceil(matchData.team2Score / 2),
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

  // For each team the player was on, get the opposing team
  const processedMatches = [];
  for (const teamPlayer of teamPlayers) {
    const team = teamMap[teamPlayer.team_id];
    if (!team) continue;

    const match = matchMap[team.match_id];
    if (!match) continue;

    // Get the opposing team
    const { data: opposingTeam, error: opposingTeamError } = await supabase
      .from('Team')
      .select('id')
      .eq('match_id', team.match_id)
      .neq('id', team.id)
      .single();

    if (opposingTeamError || !opposingTeam) {
      console.error('Error fetching opposing team:', opposingTeamError);
      continue;
    }

    // Get the opposing team players
    const { data: opposingTeamPlayers, error: opposingTeamPlayersError } = await supabase
      .from('TeamPlayer')
      .select('user_id')
      .eq('team_id', opposingTeam.id);

    if (opposingTeamPlayersError || !opposingTeamPlayers) {
      console.error('Error fetching opposing team players:', opposingTeamPlayersError);
      continue;
    }

    // Get the opposing players' names
    const opposingPlayerIds = opposingTeamPlayers.map(tp => tp.user_id);
    const { data: opposingUsers, error: opposingUsersError } = await supabase
      .from('User')
      .select('id, name')
      .in('id', opposingPlayerIds);

    if (opposingUsersError || !opposingUsers) {
      console.error('Error fetching opposing users:', opposingUsersError);
      continue;
    }

    // Determine if the player's team won
    const isWhiteTeam = team.color === TeamColor.WHITE;
    const whiteScore = match.team_white_score;
    const blueScore = match.team_blue_score;
    const playerTeamScore = isWhiteTeam ? whiteScore : blueScore;
    const opposingTeamScore = isWhiteTeam ? blueScore : whiteScore;
    const result = playerTeamScore > opposingTeamScore ? 'Win' : (playerTeamScore < opposingTeamScore ? 'Loss' : 'Draw');

    // Calculate ELO change
    const eloChange = teamPlayer.new_elo - teamPlayer.old_elo;

    // Format the opposing team's name
    const opposingTeamName = `Team ${opposingUsers.map(u => u.name.split(' ')[0]).join(' & ')}`;

    // Format the date
    const date = new Date(match.created_at);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric'
    });

    processedMatches.push({
      date: formattedDate,
      fullDate: match.created_at,
      opponent: opposingTeamName,
      result,
      score: `${playerTeamScore}-${opposingTeamScore}`,
      ratingChange: eloChange > 0 ? `+${eloChange}` : `${eloChange}`,
      elo: teamPlayer.new_elo
    });
  }

  return processedMatches;
}

// Function to get a player's ELO rating history
export async function getPlayerEloHistory(userId: number): Promise<any[]> {
  const { data: teamPlayers, error } = await supabase
    .from('TeamPlayer')
    .select('new_elo, created_at')
    .eq('user_id', userId)
    .order('created_at');

  if (error || !teamPlayers) {
    console.error('Error fetching ELO history:', error);
    return [];
  }

  // Get the initial ELO from the user table
  const { data: user, error: userError } = await supabase
    .from('User')
    .select('elo_score')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('Error fetching user ELO:', userError);
    return [];
  }

  // If there are no matches, return only the current ELO
  if (teamPlayers.length === 0) {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    return [{
      date: formattedDate,
      rating: user.elo_score
    }];
  }

  // Process the data to create the history
  const eloHistory = teamPlayers.map(tp => {
    const date = new Date(tp.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    return {
      date: formattedDate,
      fullDate: tp.created_at,
      rating: tp.new_elo
    };
  });

  // Add the current ELO as the latest entry
  const latestMatch = new Date(teamPlayers[teamPlayers.length - 1].created_at);
  const currentDate = new Date();
  
  // Only add current ELO if it's been at least a day since the last match
  if ((currentDate.getTime() - latestMatch.getTime()) > (24 * 60 * 60 * 1000)) {
    const formattedCurrentDate = currentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    eloHistory.push({
      date: formattedCurrentDate,
      fullDate: currentDate.toISOString(),
      rating: user.elo_score
    });
  }

  return eloHistory;
}
