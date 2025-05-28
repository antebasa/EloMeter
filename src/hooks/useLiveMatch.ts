import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface LiveMatch {
  id: number;
  white_team_defense_id: number;
  white_team_offense_id: number;
  blue_team_defense_id: number;
  blue_team_offense_id: number;
  white_score: number;
  blue_score: number;
  status: string;
  confirmed_by_white: boolean;
  confirmed_by_blue: boolean;
  finished_at?: string;
  created_at: string;
}

export const useLiveMatch = (matchId?: string) => {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    const loadMatch = async () => {
      try {
        const { data, error } = await supabase
          .from('live_matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error) throw error;
        setMatch(data);
        setError(null);
      } catch (err) {
        console.error('Error loading match:', err);
        setError('Failed to load match');
        setMatch(null);
      } finally {
        setLoading(false);
      }
    };

    loadMatch();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`live_match_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            setMatch(payload.new as LiveMatch);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const updateScore = async (scoreType: 'white_attack' | 'blue_attack' | 'white_backspace' | 'blue_backspace' | 'white_defense' | 'blue_defense') => {
    if (!match) return false;

    try {
      let newWhiteScore = match.white_score;
      let newBlueScore = match.blue_score;

      switch (scoreType) {
        case 'white_attack':
          newWhiteScore += 1;
          break;
        case 'blue_attack':
          newBlueScore += 1;
          break;
        case 'white_backspace':
          newWhiteScore = Math.max(0, newWhiteScore - 1);
          break;
        case 'blue_backspace':
          newBlueScore = Math.max(0, newBlueScore - 1);
          break;
        case 'white_defense':
          newBlueScore = Math.max(0, newBlueScore - 1);
          break;
        case 'blue_defense':
          newWhiteScore = Math.max(0, newWhiteScore - 1);
          break;
      }

      const { error } = await supabase
        .from('live_matches')
        .update({
          white_score: newWhiteScore,
          blue_score: newBlueScore,
        })
        .eq('id', matchId);

      if (error) throw error;

      // Check if game is finished (first to 10 goals)
      if (newWhiteScore >= 10 || newBlueScore >= 10) {
        await supabase
          .from('live_matches')
          .update({ 
            status: 'finished', 
            finished_at: new Date().toISOString() 
          })
          .eq('id', matchId);
      }

      return true;
    } catch (err) {
      console.error('Error updating score:', err);
      setError('Failed to update score');
      return false;
    }
  };

  return {
    match,
    loading,
    error,
    updateScore,
  };
};

export type { LiveMatch }; 