#!/usr/bin/env python3
"""
ELO Recalculation Script using Improved Algorithm
Processes match data and generates SQL update statements for PostgreSQL
"""

import json
import math
from typing import Dict, List, Tuple, Any

# Default ELO parameters matching the improved algorithm
DEFAULT_ELO_PARAMETERS = {
    'baseKFactor': 60,
    'scoreDiffMultiplier': 1.50,
    'skillGapThreshold': 50,
    'maxEloChange': 150,
    'aggressiveScoreThreshold': 8,
    'skillGapPenalty': 0.60,
    'balancedTeamBonus': 1.50
}

DEFAULT_ELO = 1400

class EloCalculator:
    def __init__(self, parameters=None):
        self.parameters = parameters or DEFAULT_ELO_PARAMETERS
    
    def calculate_improved_elo(self, team1_defense, team1_offense, team2_defense, team2_offense, 
                             team1_score, team2_score):
        """Calculate ELO changes using the improved algorithm"""
        
        # Get current ELO ratings
        t1_def_elo = team1_defense.get('elo_defense', DEFAULT_ELO)
        t1_off_elo = team1_offense.get('elo_offense', DEFAULT_ELO)
        t2_def_elo = team2_defense.get('elo_defense', DEFAULT_ELO)
        t2_off_elo = team2_offense.get('elo_offense', DEFAULT_ELO)
        
        # Calculate team ELO using weighted formula
        team1_weaker_elo = min(t1_def_elo, t1_off_elo)
        team1_stronger_elo = max(t1_def_elo, t1_off_elo)
        team1_avg = team1_weaker_elo * 0.9 + team1_stronger_elo * 0.1
        
        team2_weaker_elo = min(t2_def_elo, t2_off_elo)
        team2_stronger_elo = max(t2_def_elo, t2_off_elo)
        team2_avg = team2_weaker_elo * 0.9 + team2_stronger_elo * 0.1
        
        # Calculate expected scores using standard ELO formula
        team1_expected = 1 / (1 + math.pow(10, (team2_avg - team1_avg) / 400))
        team2_expected = 1 - team1_expected
        
        # Calculate actual scores (normalized)
        total_score = team1_score + team2_score
        team1_actual = team1_score / total_score if total_score > 0 else 0.5
        team2_actual = team2_score / total_score if total_score > 0 else 0.5
        
        # Determine if score is aggressive
        score_diff = abs(team1_score - team2_score)
        is_aggressive_score = score_diff >= self.parameters['aggressiveScoreThreshold']
        
        # Analyze team skill composition
        team1_skill_gap = abs(t1_def_elo - t1_off_elo)
        team2_skill_gap = abs(t2_def_elo - t2_off_elo)
        team_elo_gap = abs(team1_avg - team2_avg)
        
        # Determine if teams are balanced
        both_teams_balanced = (team1_skill_gap < self.parameters['skillGapThreshold'] and 
                              team2_skill_gap < self.parameters['skillGapThreshold'])
        one_team_imbalanced = ((team1_skill_gap >= self.parameters['skillGapThreshold']) != 
                              (team2_skill_gap >= self.parameters['skillGapThreshold']))
        
        # Calculate dynamic K-factor
        k_factor = self.parameters['baseKFactor']
        
        # Adjust K-factor for score differences
        score_diff_impact = min(score_diff * self.parameters['scoreDiffMultiplier'], 3.0)
        k_factor *= (1 + score_diff_impact)
        
        # Adjust K-factor for skill gaps
        if team_elo_gap > self.parameters['skillGapThreshold']:
            if one_team_imbalanced:
                k_factor *= (1 - self.parameters['skillGapPenalty'])
            elif both_teams_balanced:
                k_factor *= self.parameters['balancedTeamBonus']
        
        # Cap the K-factor
        k_factor = min(k_factor, self.parameters['maxEloChange'])
        
        # Calculate base ELO changes
        team1_base_change = k_factor * (team1_actual - team1_expected)
        team2_base_change = k_factor * (team2_actual - team2_expected)
        
        # Apply additional modifiers for extreme scenarios
        team1_multiplier = 1
        team2_multiplier = 1
        
        # Apply aggressive score handicap when weaker team wins aggressively
        if is_aggressive_score:
            if team1_avg < team2_avg - self.parameters['skillGapThreshold'] and team1_score > team2_score:
                team1_multiplier = 2.5
                team2_multiplier = 0.5
            elif team2_avg < team1_avg - self.parameters['skillGapThreshold'] and team2_score > team1_score:
                team2_multiplier = 2.5
                team1_multiplier = 0.5
            elif team_elo_gap <= self.parameters['skillGapThreshold']:
                if team1_avg > team2_avg + self.parameters['skillGapThreshold'] and team1_score < team2_score:
                    team1_multiplier = 2.0
                    team2_multiplier = 0.6
                elif team2_avg > team1_avg + self.parameters['skillGapThreshold'] and team2_score < team1_score:
                    team2_multiplier = 2.0
                    team1_multiplier = 0.6
        
        # Calculate final ELO changes
        team1_defense_change = round(team1_base_change * team1_multiplier)
        team1_offense_change = round(team1_base_change * team1_multiplier)
        team2_defense_change = round(team2_base_change * team2_multiplier)
        team2_offense_change = round(team2_base_change * team2_multiplier)
        
        # ELO CHANGE LIMITS for teams with large skill deficiency
        if team_elo_gap > self.parameters['skillGapThreshold']:
            max_loss_for_weaker = 15
            max_gain_for_stronger = 25
            
            if team1_avg < team2_avg:
                if team1_defense_change < -max_loss_for_weaker:
                    team1_defense_change = -max_loss_for_weaker
                    team1_offense_change = -max_loss_for_weaker
                if team2_defense_change > max_gain_for_stronger:
                    team2_defense_change = max_gain_for_stronger
                    team2_offense_change = max_gain_for_stronger
            else:
                if team2_defense_change < -max_loss_for_weaker:
                    team2_defense_change = -max_loss_for_weaker
                    team2_offense_change = -max_loss_for_weaker
                if team1_defense_change > max_gain_for_stronger:
                    team1_defense_change = max_gain_for_stronger
                    team1_offense_change = max_gain_for_stronger
        
        # Winner protection - ensure minimum gain for winning team
        min_winner_gain = 2
        
        if team1_score > team2_score:
            if team1_defense_change < min_winner_gain:
                team1_defense_change = min_winner_gain
                team1_offense_change = min_winner_gain
        elif team2_score > team1_score:
            if team2_defense_change < min_winner_gain:
                team2_defense_change = min_winner_gain
                team2_offense_change = min_winner_gain
        
        return {
            'team1DefenseChange': team1_defense_change,
            'team1OffenseChange': team1_offense_change,
            'team2DefenseChange': team2_defense_change,
            'team2OffenseChange': team2_offense_change
        }

def parse_data_file(filename):
    """Parse the current_values.txt file to extract match data, user data, and player match stats"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"File length: {len(content)} characters")
        
        # Split the content by query results
        parts = content.split('query ')
        print(f"Split into {len(parts)} parts")
        
        if len(parts) < 5:
            print("Error: Expected at least 5 parts after splitting by 'query'")
            print("Parts found:", [part[:50] + "..." if len(part) > 50 else part for part in parts])
            return None, None, None, None
        
        # Extract match data (query 1) - parts[1] contains "1 result:"
        print("Extracting match data...")
        match_data_str = parts[1].split('result:\n')[1].strip()
        # Find the end of the JSON array
        match_data_str = match_data_str.split('\n\n')[0]
        matches = json.loads(match_data_str)
        print(f"Loaded {len(matches)} matches")
        
        # Extract user data (query 2) - parts[2] contains "2 result:"
        print("Extracting user data...")
        user_data_str = parts[2].split('result:\n')[1].strip()
        # Find the end of the JSON array
        user_data_str = user_data_str.split('\n\n')[0]
        users = json.loads(user_data_str)
        print(f"Loaded {len(users)} users")
        
        # Extract player match stats (query 3) - parts[3] contains "3 resukt:"
        print("Extracting player match stats...")
        stats_data_str = parts[3].split('resukt:\n')[1].strip()
        # Find the end of the JSON array (before "Additional query")
        stats_data_str = stats_data_str.split('\n\nAdditional')[0]
        player_match_stats = json.loads(stats_data_str)
        print(f"Loaded {len(player_match_stats)} player match stats")
        
        # Extract starting ELO data - parts[4] contains the starting ELO data
        print("Extracting starting ELO data...")
        starting_elo_str = parts[4].split('offense:\n')[1].strip()
        # Find the end of the JSON array
        starting_elo_str = starting_elo_str.split('\n\nold_elo is deffense')[0]
        starting_elo_data = json.loads(starting_elo_str)
        print(f"Loaded {len(starting_elo_data)} starting ELO records")
        
        return matches, users, player_match_stats, starting_elo_data
        
    except Exception as e:
        print(f"Detailed parsing error: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None, None

def main():
    print("Starting ELO recalculation with improved algorithm...")
    
    # Parse the data file
    try:
        matches, users_data, player_match_stats, starting_elo_data = parse_data_file('current_values.txt')
        if matches is None:
            print("Failed to parse data file")
            return
        print(f"Loaded {len(matches)} matches, {len(users_data)} users, {len(player_match_stats)} player match stats")
        print(f"Loaded starting ELO data for {len(starting_elo_data)} users")
    except Exception as e:
        print(f"Error parsing data file: {e}")
        return
    
    # Create a mapping of starting ELO values
    starting_elos = {}
    for elo_data in starting_elo_data:
        starting_elos[elo_data['user_id']] = {
            'elo_defense': elo_data['old_elo'],
            'elo_offense': elo_data['old_elo_offense']
        }
    
    # Initialize users with their actual starting ELO values
    users = {}
    for user in users_data:
        user_id = user['id']
        if user_id in starting_elos:
            users[user_id] = {
                'id': user_id,
                'name': user['name'],
                'elo_defense': starting_elos[user_id]['elo_defense'],
                'elo_offense': starting_elos[user_id]['elo_offense']
            }
        else:
            # Fallback to default ELO if no starting data found
            users[user_id] = {
                'id': user_id,
                'name': user['name'],
                'elo_defense': DEFAULT_ELO,
                'elo_offense': DEFAULT_ELO
            }
            print(f"Warning: No starting ELO data found for user {user['name']}, using default {DEFAULT_ELO}")
    
    print(f"\nStarting ELO values:")
    for user in sorted(users.values(), key=lambda x: x['name']):
        print(f"{user['name']}: Defense {user['elo_defense']}, Offense {user['elo_offense']}")
    
    # Initialize ELO calculator
    calculator = EloCalculator()
    
    # Storage for updates
    player_match_stats_updates = []
    user_elo_updates = []
    
    # Process each match in chronological order
    print("\nProcessing matches...")
    for i, match in enumerate(matches):
        match_id = match['match_id']
        
        # Get players
        team1_defense = users[match['white_defense_id']]
        team1_offense = users[match['white_offense_id']]
        team2_defense = users[match['blue_defense_id']]
        team2_offense = users[match['blue_offense_id']]
        
        # Store old ELO values
        old_elos = {
            'team1_defense': team1_defense['elo_defense'],
            'team1_offense': team1_offense['elo_offense'],
            'team2_defense': team2_defense['elo_defense'],
            'team2_offense': team2_offense['elo_offense']
        }
        
        # Calculate ELO changes
        result = calculator.calculate_improved_elo(
            team1_defense, team1_offense, team2_defense, team2_offense,
            match['team_white_score'], match['team_blue_score']
        )
        
        # Update user ELOs
        team1_defense['elo_defense'] += result['team1DefenseChange']
        team1_offense['elo_offense'] += result['team1OffenseChange']
        team2_defense['elo_defense'] += result['team2DefenseChange']
        team2_offense['elo_offense'] += result['team2OffenseChange']
        
        # Store the match result for SQL generation
        match_result = {
            'match_id': match_id,
            'players': {
                match['white_defense_id']: {
                    'old_elo_defense': old_elos['team1_defense'],
                    'new_elo_defense': team1_defense['elo_defense'],
                    'old_elo_offense': team1_defense['elo_offense'],  # unchanged for defense player
                    'new_elo_offense': team1_defense['elo_offense']   # unchanged for defense player
                },
                match['white_offense_id']: {
                    'old_elo_defense': team1_offense['elo_defense'],  # unchanged for offense player
                    'new_elo_defense': team1_offense['elo_defense'],  # unchanged for offense player
                    'old_elo_offense': old_elos['team1_offense'],
                    'new_elo_offense': team1_offense['elo_offense']
                },
                match['blue_defense_id']: {
                    'old_elo_defense': old_elos['team2_defense'],
                    'new_elo_defense': team2_defense['elo_defense'],
                    'old_elo_offense': team2_defense['elo_offense'],  # unchanged for defense player
                    'new_elo_offense': team2_defense['elo_offense']   # unchanged for defense player
                },
                match['blue_offense_id']: {
                    'old_elo_defense': team2_offense['elo_defense'],  # unchanged for offense player
                    'new_elo_defense': team2_offense['elo_defense'],  # unchanged for offense player
                    'old_elo_offense': old_elos['team2_offense'],
                    'new_elo_offense': team2_offense['elo_offense']
                }
            }
        }
        
        player_match_stats_updates.append(match_result)
        
        if (i + 1) % 10 == 0:
            print(f"Processed {i + 1}/{len(matches)} matches...")
    
    print(f"\nCompleted processing {len(matches)} matches!")
    
    # Generate SQL UPDATE statements for PlayerMatchStats
    print("\nGenerating PlayerMatchStats UPDATE statements...")
    pms_sql_statements = []
    
    for match_result in player_match_stats_updates:
        match_id = match_result['match_id']
        
        for user_id, elo_data in match_result['players'].items():
            # Find the corresponding PlayerMatchStats record
            pms_record = None
            for pms in player_match_stats:
                if pms['match_id'] == match_id and pms['user_id'] == user_id:
                    pms_record = pms
                    break
            
            if pms_record:
                sql = f"""UPDATE public."PlayerMatchStats" 
SET old_elo = {elo_data['old_elo_defense']}, 
    new_elo = {elo_data['new_elo_defense']}, 
    old_elo_offense = {elo_data['old_elo_offense']}, 
    new_elo_offense = {elo_data['new_elo_offense']}
WHERE id = {pms_record['id']};"""
                pms_sql_statements.append(sql)
    
    # Generate SQL UPDATE statements for User table
    print("Generating User table UPDATE statements...")
    user_sql_statements = []
    
    for user_id, user in users.items():
        sql = f"""UPDATE public."User" 
SET elo_defense = {user['elo_defense']}, 
    elo_offense = {user['elo_offense']}
WHERE id = {user_id};"""
        user_sql_statements.append(sql)
    
    # Write SQL statements to files
    with open('update_player_match_stats.sql', 'w') as f:
        f.write("-- PlayerMatchStats ELO Updates using Improved Algorithm\n")
        f.write("-- Generated automatically - review before executing\n\n")
        f.write("BEGIN;\n\n")
        for sql in pms_sql_statements:
            f.write(sql + "\n")
        f.write("\nCOMMIT;\n")
    
    with open('update_user_elos.sql', 'w') as f:
        f.write("-- User ELO Updates using Improved Algorithm\n")
        f.write("-- Generated automatically - review before executing\n\n")
        f.write("BEGIN;\n\n")
        for sql in user_sql_statements:
            f.write(sql + "\n")
        f.write("\nCOMMIT;\n")
    
    print(f"\nGenerated {len(pms_sql_statements)} PlayerMatchStats updates")
    print(f"Generated {len(user_sql_statements)} User ELO updates")
    print("\nSQL files created:")
    print("- update_player_match_stats.sql")
    print("- update_user_elos.sql")
    
    # Display final ELO ratings
    print("\nFinal ELO Ratings:")
    for user in sorted(users.values(), key=lambda x: x['name']):
        print(f"{user['name']}: Defense {user['elo_defense']}, Offense {user['elo_offense']}")

if __name__ == "__main__":
    main() 