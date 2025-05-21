import { createClient } from '@supabase/supabase-js';

// Use environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Basic check to ensure variables are loaded
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file or environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Constants
const DEFAULT_ELO = 1400;
const K_FACTOR = 80;
const SCORE_DIFF_MULTIPLIER = 0.15;

export interface User {
  id: number;
  name: string;
  email?: string;
  created_at?: string; // This is timestamp with time zone in DB
  scored?: number;
  conceded?: number;
  wins?: number;
  losses?: number;
  played?: number;
  elo_offense?: number;
  elo_defense?: number;
}

// export enum TeamColor { // No longer used directly in Team table for match context
//   BLUE = 'blue',
//   WHITE = 'white'
// }

export interface MatchData {
  team1Defense: string; // user_id
  team1Offense: string; // user_id
  team2Defense: string; // user_id
  team2Offense: string; // user_id
  team1Score: number;
  team2Score: number;
  date?: string | Date; // User added this for custom match date
  // Optional individual goals not directly used in this refactor, team scores are primary
  team1DefenseGoals?: number;
  team1OffenseGoals?: number;
  team2DefenseGoals?: number;
  team2OffenseGoals?: number;
}

interface JoinedMatchDetails {
    id: number;
    created_at: string;
    white_team_id: number;
    blue_team_id: number;
    team_white_score: number;
    team_blue_score: number;
}

interface JoinedTeamDetails {
    id: number;
    user1_id: number;
    user2_id: number;
    name?: string;
}

// This is the type for entries coming from the PlayerMatchStats table itself,
// with foreign keys resolved to actual objects due to joins.
interface PlayerMatchStatsQueryResultEntry {
    id: number;
    user_id: number;
    created_at: string; // This is the created_at from PlayerMatchStats, should be match date
    scored: number;
    conceded: number;
    old_elo: number;
    new_elo: number;
    old_elo_offense: number;
    new_elo_offense: number;
    match_id: JoinedMatchDetails; // !inner join ensures this is not null
    team_id: JoinedTeamDetails;   // !inner join ensures this is not null
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

// ELO calculation functions (no change needed here)
function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

function updateElo(playerElo: number, expectedScore: number, actualScore: number, scoreDiff: number | null = null): number {
  let baseChange = K_FACTOR * (actualScore - expectedScore);
  if (scoreDiff !== null) {
    const scoreImpact = Math.min(Math.abs(scoreDiff) * SCORE_DIFF_MULTIPLIER, 1.0);
    baseChange *= (1 + scoreImpact);
  }
  return playerElo + baseChange;
}

// Helper to get or create a team
async function getOrCreateTeam(user1Id: number, user2Id: number, matchDate?: string | Date, teamName?: string): Promise<number> {
  const u1 = Math.min(user1Id, user2Id);
  const u2 = Math.max(user1Id, user2Id);

  const { data: existingTeams, error: fetchError } = await supabase
    .from('Team')
    .select('id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .limit(1);

  if (fetchError) {
    console.error('Error fetching team:', fetchError);
    throw fetchError;
  }

  if (existingTeams && existingTeams.length > 0) {
    return existingTeams[0].id;
  } else {
    const newTeamData: any = { user1_id: u1, user2_id: u2 };
    if (teamName) newTeamData.name = teamName;

    // DB schema for Team.created_at is 'date'
    newTeamData.created_at = matchDate ? new Date(matchDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];


    const { data: newTeam, error: insertError } = await supabase
      .from('Team')
      .insert(newTeamData)
      .select('id')
      .single();

    if (insertError || !newTeam) {
      console.error('Error creating team:', insertError);
      throw insertError || new Error('Failed to create team and retrieve ID');
    }
    return newTeam.id;
  }
}

export async function saveMatch(matchData: MatchData): Promise<{ success: boolean; error?: any }> {
  try {
    const playerIds = [
      parseInt(matchData.team1Defense),
      parseInt(matchData.team1Offense),
      parseInt(matchData.team2Defense),
      parseInt(matchData.team2Offense)
    ].filter((id, index, self) => self.indexOf(id) === index); // Ensure unique IDs

    const { data: usersData, error: getUsersError } = await supabase
      .from('User')
      .select('id, name, elo_offense, elo_defense, scored, conceded, wins, losses, played')
      .in('id', playerIds);

    if (getUsersError || !usersData || usersData.length < playerIds.length) {
      console.error('Error fetching user data or not all users found:', getUsersError, usersData);
      return { success: false, error: getUsersError || 'Not all users found' };
    }

    const userMap = usersData.reduce((acc, user) => {
      acc[user.id] = user as User; // Cast to User to satisfy type, ensure all fields are present
      return acc;
    }, {} as Record<number, User>);

    const t1dId = parseInt(matchData.team1Defense);
    const t1oId = parseInt(matchData.team1Offense);
    const t2dId = parseInt(matchData.team2Defense);
    const t2oId = parseInt(matchData.team2Offense);

    const matchDateToUse = matchData.date ? new Date(matchData.date) : new Date();
    const matchDateString = matchDateToUse.toISOString().split('T')[0];

    const whiteTeamId = await getOrCreateTeam(t1dId, t1oId, matchDateToUse);
    const blueTeamId = await getOrCreateTeam(t2dId, t2oId, matchDateToUse);

    const t1dDefElo = userMap[t1dId]?.elo_defense || DEFAULT_ELO;
    const t1oOffElo = userMap[t1oId]?.elo_offense || DEFAULT_ELO;
    const t2dDefElo = userMap[t2dId]?.elo_defense || DEFAULT_ELO;
    const t2oOffElo = userMap[t2oId]?.elo_offense || DEFAULT_ELO;

    const team1Elo = (t1dDefElo + t1oOffElo) / 2;
    const team2Elo = (t2dDefElo + t2oOffElo) / 2;

    const t1Expected = calculateExpectedScore(team1Elo, team2Elo);
    const t2Expected = 1 - t1Expected;
    const totalScoreValue = matchData.team1Score + matchData.team2Score;
    const t1Actual = totalScoreValue > 0 ? matchData.team1Score / totalScoreValue : 0.5;
    const t2Actual = totalScoreValue > 0 ? matchData.team2Score / totalScoreValue : 0.5;
    const scoreDiff = matchData.team1Score - matchData.team2Score;

    const newT1dDefElo = Math.round(updateElo(t1dDefElo, t1Expected, t1Actual, scoreDiff));
    const newT1oOffElo = Math.round(updateElo(t1oOffElo, t1Expected, t1Actual, scoreDiff));
    const newT2dDefElo = Math.round(updateElo(t2dDefElo, t2Expected, t2Actual, -scoreDiff));
    const newT2oOffElo = Math.round(updateElo(t2oOffElo, t2Expected, t2Actual, -scoreDiff));

    const { data: matchInsertData, error: matchInsertError } = await supabase
      .from('Match')
      .insert({
        white_team_id: whiteTeamId,
        blue_team_id: blueTeamId,
        team_white_score: matchData.team1Score,
        team_blue_score: matchData.team2Score,
        created_at: matchDateString
      })
      .select('id')
      .single();

    if (matchInsertError || !matchInsertData) {
      console.error('Error inserting match:', matchInsertError);
      return { success: false, error: matchInsertError };
    }
    const matchId = matchInsertData.id;

    const playerMatchStatsData = [
      {
        match_id: matchId, user_id: t1dId, team_id: whiteTeamId,
        scored: matchData.team1Score, conceded: matchData.team2Score,
        old_elo: t1dDefElo, new_elo: newT1dDefElo,
        old_elo_offense: userMap[t1dId]?.elo_offense || DEFAULT_ELO,
        new_elo_offense: userMap[t1dId]?.elo_offense || DEFAULT_ELO,
        created_at: matchDateString
      },
      {
        match_id: matchId, user_id: t1oId, team_id: whiteTeamId,
        scored: matchData.team1Score, conceded: matchData.team2Score,
        old_elo: userMap[t1oId]?.elo_defense || DEFAULT_ELO,
        new_elo: userMap[t1oId]?.elo_defense || DEFAULT_ELO,
        old_elo_offense: t1oOffElo, new_elo_offense: newT1oOffElo,
        created_at: matchDateString
      },
      {
        match_id: matchId, user_id: t2dId, team_id: blueTeamId,
        scored: matchData.team2Score, conceded: matchData.team1Score,
        old_elo: t2dDefElo, new_elo: newT2dDefElo,
        old_elo_offense: userMap[t2dId]?.elo_offense || DEFAULT_ELO,
        new_elo_offense: userMap[t2dId]?.elo_offense || DEFAULT_ELO,
        created_at: matchDateString
      },
      {
        match_id: matchId, user_id: t2oId, team_id: blueTeamId,
        scored: matchData.team2Score, conceded: matchData.team1Score,
        old_elo: userMap[t2oId]?.elo_defense || DEFAULT_ELO,
        new_elo: userMap[t2oId]?.elo_defense || DEFAULT_ELO,
        old_elo_offense: t2oOffElo, new_elo_offense: newT2oOffElo,
        created_at: matchDateString
      }
    ];

    const { error: pmsError } = await supabase.from('PlayerMatchStats').insert(playerMatchStatsData);
    if (pmsError) {
      console.error('Error inserting player match stats:', pmsError);
      return { success: false, error: pmsError };
    }

    const team1Won = matchData.team1Score > matchData.team2Score;
    const isDraw = matchData.team1Score === matchData.team2Score;

    const userUpdatesPayload = [
        { id: t1dId, elo_defense: newT1dDefElo, scored_this_match: matchData.team1Score, conceded_this_match: matchData.team2Score, won: team1Won, isDraw: isDraw },
        { id: t1oId, elo_offense: newT1oOffElo, scored_this_match: matchData.team1Score, conceded_this_match: matchData.team2Score, won: team1Won, isDraw: isDraw },
        { id: t2dId, elo_defense: newT2dDefElo, scored_this_match: matchData.team2Score, conceded_this_match: matchData.team1Score, won: !team1Won && !isDraw, isDraw: isDraw },
        { id: t2oId, elo_offense: newT2oOffElo, scored_this_match: matchData.team2Score, conceded_this_match: matchData.team1Score, won: !team1Won && !isDraw, isDraw: isDraw }
    ];

    for (const update of userUpdatesPayload) {
      const currentUser = userMap[update.id];
      if (!currentUser) continue; // Should not happen if initial fetch was correct
      const userStatUpdate: Partial<User> = {
        played: (currentUser.played || 0) + 1,
        scored: (currentUser.scored || 0) + update.scored_this_match,
        conceded: (currentUser.conceded || 0) + update.conceded_this_match,
        wins: (currentUser.wins || 0) + (update.won ? 1 : 0),
        losses: (currentUser.losses || 0) + (!update.won && !update.isDraw ? 1 : 0),
      };
      if ('elo_defense' in update && update.elo_defense !== undefined) {
        userStatUpdate.elo_defense = update.elo_defense;
      }
      if ('elo_offense' in update && update.elo_offense !== undefined) {
        userStatUpdate.elo_offense = update.elo_offense;
      }
      
      const { error: userUpdateError } = await supabase.from('User').update(userStatUpdate).eq('id', update.id);
      if (userUpdateError) {
        console.error(`Error updating user ${update.id}:`, userUpdateError);
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving match:', error);
    return { success: false, error };
  }
}

export async function getPlayerMatchHistory(userId: number): Promise<any[]> {
  const { data: playerStatsEntries, error: pmsError } = await supabase
    .from('PlayerMatchStats')
    .select(`
      id, user_id, created_at, scored, conceded, old_elo, new_elo, old_elo_offense, new_elo_offense, 
      match_id!inner ( id, created_at, white_team_id, blue_team_id, team_white_score, team_blue_score ),
      team_id!inner ( id, user1_id, user2_id, name )
    `)
    .eq('user_id', userId)
    .order('created_at', { foreignTable: 'match_id', ascending: false });

  if (pmsError || !playerStatsEntries) {
    console.error('Error fetching player match stats:', pmsError);
    return [];
  }

  const typedPlayerStatsEntries = playerStatsEntries as unknown as PlayerMatchStatsQueryResultEntry[];
  if (typedPlayerStatsEntries.length === 0) return [];

  const allTeamIdsInHistory = new Set<number>();
  typedPlayerStatsEntries.forEach(entry => {
    allTeamIdsInHistory.add(entry.team_id.id);
    allTeamIdsInHistory.add(entry.match_id.white_team_id);
    allTeamIdsInHistory.add(entry.match_id.blue_team_id);
  });

  const uniqueTeamIdsArray = [...allTeamIdsInHistory].filter(id => id != null); // Filter out potential nulls if any team ID could be null

  let teamDetailsMap: Record<number, JoinedTeamDetails> = {};
  if (uniqueTeamIdsArray.length > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from('Team')
      .select('id, user1_id, user2_id, name')
      .in('id', uniqueTeamIdsArray);
    if (teamsError) {
      console.error('Error fetching teams for history:', teamsError);
      // Decide if to throw, return partial, or empty. For now, continue and some names might be 'Unknown'.
    } else if (teams) {
      teams.forEach(t => teamDetailsMap[t.id] = t as JoinedTeamDetails);
    }
  }

  const allUserIdsInHistory = new Set<number>();
  Object.values(teamDetailsMap).forEach(team => {
    if (team.user1_id) allUserIdsInHistory.add(team.user1_id);
    if (team.user2_id) allUserIdsInHistory.add(team.user2_id);
  });
  // Also ensure the user whose history is being fetched is included, in case they have no teams (should not happen with PlayerMatchStats)
  allUserIdsInHistory.add(userId);


  const uniqueUserIdsArray = [...allUserIdsInHistory].filter(id => id != null);

  let userMap: Record<number, { id: number; name: string }> = {};
  if (uniqueUserIdsArray.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, name')
      .in('id', uniqueUserIdsArray);
    if (usersError) {
      console.error('Error fetching users for history:', usersError);
      // Decide if to throw, return partial, or empty. For now, continue and some names might be 'Unknown' or 'Player'.
    } else if (users) {
      users.forEach(u => userMap[u.id] = u as { id: number; name: string });
    }
  }


  return typedPlayerStatsEntries.map(pms => {
    // With !inner joins, pms.match_id and pms.team_id are guaranteed to exist.
    const matchDetails = pms.match_id;
    const playerTeamDetails = teamDetailsMap[pms.team_id.id] || pms.team_id; // Fallback to pms.team_id if not in map (should be)

    const playerScore = pms.scored;
    const opponentScore = pms.conceded;
    const won = playerScore > opponentScore;
    const resultString = won ? 'Win' : (playerScore === opponentScore ? 'Draw' : 'Loss');
    const formattedScoreString = `${playerScore}-${opponentScore}`;

    let eloChange = 0;
    if (pms.new_elo !== pms.old_elo) eloChange = pms.new_elo - pms.old_elo;
    else if (pms.new_elo_offense !== pms.old_elo_offense) eloChange = pms.new_elo_offense - pms.old_elo_offense;

    let teammateName = '-';
    if (playerTeamDetails) {
        const teammateId = playerTeamDetails.user1_id === userId ? playerTeamDetails.user2_id : playerTeamDetails.user1_id;
        if (teammateId !== userId) {
             teammateName = userMap[teammateId]?.name || 'Unknown';
        }
    }

    let opponentsString = 'Unknown Opponents';
    const opponentTeamId = matchDetails.white_team_id === playerTeamDetails.id ? matchDetails.blue_team_id : matchDetails.white_team_id;

    if (opponentTeamId) {
        const opponentTeamDetails = teamDetailsMap[opponentTeamId];
        if (opponentTeamDetails) {
            const opp1Name = userMap[opponentTeamDetails.user1_id]?.name || 'Player';
            const opp2Name = userMap[opponentTeamDetails.user2_id]?.name || 'Player';
            opponentsString = opponentTeamDetails.user1_id === opponentTeamDetails.user2_id ? opp1Name : `${opp1Name} & ${opp2Name}`;
        }
    }

    return {
      id: pms.id,
      match_db_id: matchDetails.id,
      date: matchDetails.created_at,
      result: resultString,
      score: formattedScoreString,
      eloChange: eloChange,
      oldElo: pms.new_elo !== pms.old_elo ? pms.old_elo : pms.old_elo_offense,
      newElo: pms.new_elo !== pms.old_elo ? pms.new_elo : pms.new_elo_offense,
      scored_by_team: pms.scored,
      conceded_by_team: pms.conceded,
      teammate: teammateName,
      opponents: opponentsString,
      player_team_id_in_match: playerTeamDetails.id,
      match_details_white_team_id: matchDetails.white_team_id,
      match_details_blue_team_id: matchDetails.blue_team_id
    };
  }).filter(Boolean);
}

// Define a more specific type for ELO history entries from PlayerMatchStats
interface EloHistoryStatEntry {
    id: number;
    created_at: string; // from PlayerMatchStats table
    old_elo: number;
    new_elo: number;
    old_elo_offense: number;
    new_elo_offense: number;
    match_id: { created_at: string }; // from joined Match table
}

export async function getPlayerEloHistory(userId: number): Promise<any[]> {
  const { data: playerStats, error: pmsError } = await supabase
    .from('PlayerMatchStats')
    .select('id, created_at, old_elo, new_elo, old_elo_offense, new_elo_offense, match_id!inner(created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (pmsError || !playerStats) {
    console.error('Error fetching player stats for Elo history:', pmsError);
    return [];
  }

  const typedEntries = playerStats as unknown as EloHistoryStatEntry[];

  const { data: userCurrentElo, error: userError } = await supabase
    .from('User')
    .select('elo_offense, elo_defense, created_at')
    .eq('id', userId)
    .single();

  if (userError || !userCurrentElo) {
    console.error('Error fetching user for Elo history:', userError);
    return [];
  }

  const offenseData: any[] = [];
  const defenseData: any[] = [];

  if (typedEntries.length === 0) {
    const initialDate = new Date(userCurrentElo.created_at || Date.now()).toISOString();
    offenseData.push({ x: initialDate, y: userCurrentElo.elo_offense || DEFAULT_ELO, id: 'initial-offense', type: 'offense' });
    defenseData.push({ x: initialDate, y: userCurrentElo.elo_defense || DEFAULT_ELO, id: 'initial-defense', type: 'defense' });
    return [...offenseData, ...defenseData].sort((a,b) => new Date(a.x).getTime() - new Date(b.x).getTime());
  }

  const firstMatchRecord = typedEntries[0];
  // Use PlayerMatchStats.created_at as it is the match date, fallback to joined match.created_at if necessary
  const firstMatchDate = new Date(firstMatchRecord.created_at || firstMatchRecord.match_id.created_at);
  const preFirstMatchDate = new Date(firstMatchDate);
  preFirstMatchDate.setDate(preFirstMatchDate.getDate() - 7);

  // Use the 'old' ELO from the very first match record as the starting point before that match.
  let initialDefenseElo = firstMatchRecord.old_elo;
  let initialOffenseElo = firstMatchRecord.old_elo_offense;

  offenseData.push({ x: preFirstMatchDate.toISOString(), y: initialOffenseElo, id: 'initial-off', type: 'offense' });
  defenseData.push({ x: preFirstMatchDate.toISOString(), y: initialDefenseElo, id: 'initial-def', type: 'defense' });

  typedEntries.forEach(ps => {
    // Use PlayerMatchStats.created_at for the X-axis point
    const matchDate = new Date(ps.created_at || ps.match_id.created_at).toISOString();
    // For each match, both new_elo (defense actual after match) and new_elo_offense (offense actual after match) are recorded.
    // These represent the ELO state *after* the match for both roles.
    defenseData.push({ x: matchDate, y: ps.new_elo, id: `match-${ps.id}-def`, type: 'defense' });
    offenseData.push({ x: matchDate, y: ps.new_elo_offense, id: `match-${ps.id}-off`, type: 'offense'});
  });

  const now = new Date().toISOString();
  offenseData.push({ x: now, y: userCurrentElo.elo_offense || DEFAULT_ELO, id: 'current-off', type: 'offense' });
  defenseData.push({ x: now, y: userCurrentElo.elo_defense || DEFAULT_ELO, id: 'current-def', type: 'defense' });

  const dedupedOffense = Array.from(new Map(offenseData.map(item => [`${item.x}-${item.type}`, item])).values());
  const dedupedDefense = Array.from(new Map(defenseData.map(item => [`${item.x}-${item.type}`, item])).values());

  return [...dedupedOffense, ...dedupedDefense].sort((a,b) => new Date(a.x).getTime() - new Date(b.x).getTime());
}

export async function getMatchHistoryBetweenTeams(
  team1Player1Id: number, 
  team1Player2Id: number, 
  team2Player1Id: number, 
  team2Player2Id: number,
  limit: number = 3
): Promise<any[]> {
  try {
    // Ensure canonical representation for team players (order by ID)
    const t1p1 = Math.min(team1Player1Id, team1Player2Id);
    const t1p2 = Math.max(team1Player1Id, team1Player2Id);
    const t2p1 = Math.min(team2Player1Id, team2Player2Id);
    const t2p2 = Math.max(team2Player1Id, team2Player2Id);

    // Find Team IDs for both teams
    const { data: team1Data, error: team1Error } = await supabase
      .from('Team')
      .select('id')
      .eq('user1_id', t1p1)
      .eq('user2_id', t1p2)
      .maybeSingle(); // Use maybeSingle as team might not exist

    if (team1Error) throw team1Error;
    if (!team1Data) return []; // Team 1 not found

    const { data: team2Data, error: team2Error } = await supabase
      .from('Team')
      .select('id')
      .eq('user1_id', t2p1)
      .eq('user2_id', t2p2)
      .maybeSingle();

    if (team2Error) throw team2Error;
    if (!team2Data) return []; // Team 2 not found

    const team1Id = team1Data.id;
    const team2Id = team2Data.id;

    // Query matches involving these two specific teams
    const { data: matches, error: matchesError } = await supabase
      .from('Match')
      .select('created_at, white_team_id, blue_team_id, team_white_score, team_blue_score')
      .or(`and(white_team_id.eq.${team1Id},blue_team_id.eq.${team2Id}),and(white_team_id.eq.${team2Id},blue_team_id.eq.${team1Id})`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (matchesError) {
      console.error('Error fetching match history between teams:', matchesError);
      throw matchesError;
    }

    return matches.map(match => ({
      date: match.created_at,
      team1Score: match.white_team_id === team1Id ? match.team_white_score : match.team_blue_score,
      team2Score: match.blue_team_id === team2Id ? match.team_blue_score : match.team_white_score,
      // To be more precise, let's indicate which actual DB team was white/blue if needed for display
      // This current structure assumes the perspective of "team1" (t1p1,t1p2) vs "team2" (t2p1,t2p2)
    }));

  } catch (error) {
    console.error('Error in getMatchHistoryBetweenTeams:', error);
    return [];
  }
}

// New function for historical matchup stats by color
export interface HistoricalMatchupStats {
  teamA_as_white: { wins: number; losses: number; draws: number; total_played: number };
  teamA_as_blue: { wins: number; losses: number; draws: number; total_played: number };
}

export async function getHistoricalMatchupStatsByColor(
  teamAPlayer1Id: number,
  teamAPlayer2Id: number,
  teamBPlayer1Id: number,
  teamBPlayer2Id: number
): Promise<HistoricalMatchupStats> {
  const result: HistoricalMatchupStats = {
    teamA_as_white: { wins: 0, losses: 0, draws: 0, total_played: 0 },
    teamA_as_blue: { wins: 0, losses: 0, draws: 0, total_played: 0 },
  };

  try {
    const teamA_u1 = Math.min(teamAPlayer1Id, teamAPlayer2Id);
    const teamA_u2 = Math.max(teamAPlayer1Id, teamAPlayer2Id);
    const teamB_u1 = Math.min(teamBPlayer1Id, teamBPlayer2Id);
    const teamB_u2 = Math.max(teamBPlayer1Id, teamBPlayer2Id);

    // Get Team ID for Team A
    const { data: teamAData, error: teamAError } = await supabase
      .from('Team')
      .select('id')
      .eq('user1_id', teamA_u1)
      .eq('user2_id', teamA_u2)
      .maybeSingle();

    if (teamAError) throw teamAError;
    if (!teamAData) return result; // Team A not found
    const teamAId = teamAData.id;

    // Get Team ID for Team B
    const { data: teamBData, error: teamBError } = await supabase
      .from('Team')
      .select('id')
      .eq('user1_id', teamB_u1)
      .eq('user2_id', teamB_u2)
      .maybeSingle();

    if (teamBError) throw teamBError;
    if (!teamBData) return result; // Team B not found
    const teamBId = teamBData.id;

    // Fetch matches where Team A was White and Team B was Blue
    const { data: teamAWhiteMatches, error: teamAWhiteError } = await supabase
      .from('Match')
      .select('team_white_score, team_blue_score')
      .eq('white_team_id', teamAId)
      .eq('blue_team_id', teamBId);

    if (teamAWhiteError) console.error('Error fetching Team A white matches:', teamAWhiteError);
    else if (teamAWhiteMatches) {
      teamAWhiteMatches.forEach(match => {
        result.teamA_as_white.total_played++;
        if (match.team_white_score > match.team_blue_score) result.teamA_as_white.wins++;
        else if (match.team_white_score < match.team_blue_score) result.teamA_as_white.losses++;
        else result.teamA_as_white.draws++;
      });
    }

    // Fetch matches where Team A was Blue and Team B was White
    const { data: teamABlueMatches, error: teamABlueError } = await supabase
      .from('Match')
      .select('team_white_score, team_blue_score')
      .eq('blue_team_id', teamAId) 
      .eq('white_team_id', teamBId);

    if (teamABlueError) console.error('Error fetching Team A blue matches:', teamABlueError);
    else if (teamABlueMatches) {
      teamABlueMatches.forEach(match => {
        result.teamA_as_blue.total_played++;
        // Team A is Blue, so team_blue_score is their score
        if (match.team_blue_score > match.team_white_score) result.teamA_as_blue.wins++;
        else if (match.team_blue_score < match.team_white_score) result.teamA_as_blue.losses++;
        else result.teamA_as_blue.draws++;
      });
    }

    return result;
  } catch (error) {
    console.error('Error in getHistoricalMatchupStatsByColor:', error);
    return result; // Return default empty stats on major error
  }
}
