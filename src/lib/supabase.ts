import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qhsguodtwbqqqfxgtups.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2d1b2R0d2JxcXFmeGd0dXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1MDMsImV4cCI6MjA2MjgxMDUwM30.GiJCjG3JhBxknz8AqP2csfDdkjdAf0nyekjVJKP3xD8';

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
  goals?: number;
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
      .select('id, name, elo_offense, elo_defense, goals, conceded, wins, losses, played') // Added name here
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
        { id: t1dId, elo_defense: newT1dDefElo, goals_scored: matchData.team1Score, goals_conceded: matchData.team2Score, won: team1Won, isDraw: isDraw },
        { id: t1oId, elo_offense: newT1oOffElo, goals_scored: matchData.team1Score, goals_conceded: matchData.team2Score, won: team1Won, isDraw: isDraw },
        { id: t2dId, elo_defense: newT2dDefElo, goals_scored: matchData.team2Score, goals_conceded: matchData.team1Score, won: !team1Won && !isDraw, isDraw: isDraw },
        { id: t2oId, elo_offense: newT2oOffElo, goals_scored: matchData.team2Score, goals_conceded: matchData.team1Score, won: !team1Won && !isDraw, isDraw: isDraw }
    ];

    for (const update of userUpdatesPayload) {
      const currentUser = userMap[update.id];
      if (!currentUser) continue; // Should not happen if initial fetch was correct
      const userStatUpdate: Partial<User> = {
        played: (currentUser.played || 0) + 1,
        goals: (currentUser.goals || 0) + update.goals_scored,
        conceded: (currentUser.conceded || 0) + update.goals_conceded,
        wins: (currentUser.wins || 0) + (update.won ? 1 : 0),
        losses: (currentUser.losses || 0) + (!update.won && !update.isDraw ? 1 : 0),
      };
      if (update.elo_defense !== undefined) userStatUpdate.elo_defense = update.elo_defense;
      if (update.elo_offense !== undefined) userStatUpdate.elo_offense = update.elo_offense;

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

  const allUserIdsInHistory = new Set<number>();
  const allTeamIdsInHistory = new Set<number>();

  typedPlayerStatsEntries.forEach(entry => {
    // entry.team_id is guaranteed by !inner join
    allUserIdsInHistory.add(entry.team_id.user1_id);
    allUserIdsInHistory.add(entry.team_id.user2_id);
    allTeamIdsInHistory.add(entry.team_id.id);

    // entry.match_id is guaranteed by !inner join
    allTeamIdsInHistory.add(entry.match_id.white_team_id);
    allTeamIdsInHistory.add(entry.match_id.blue_team_id);
  });

  const uniqueUserIdsArray = [...allUserIdsInHistory];
  const uniqueTeamIdsArray = [...allTeamIdsInHistory];

  let userMap: Record<number, { id: number; name: string }> = {};
  if (uniqueUserIdsArray.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, name')
      .in('id', uniqueUserIdsArray);
    if (usersError) console.error('Error fetching users for history:', usersError);
    else if (users) users.forEach(u => userMap[u.id] = u as { id: number; name: string });
  }

  let teamDetailsMap: Record<number, JoinedTeamDetails> = {};
   if (uniqueTeamIdsArray.length > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from('Team')
      .select('id, user1_id, user2_id, name')
      .in('id', uniqueTeamIdsArray);
    if (teamsError) console.error('Error fetching teams for history:', teamsError);
    else if (teams) teams.forEach(t => teamDetailsMap[t.id] = t as JoinedTeamDetails);
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
      opponents: opponentsString
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
