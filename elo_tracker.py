#!/usr/bin/env python3

import os
import math
import shutil
from datetime import datetime

# Constants
DEFAULT_ELO = 1400
K_FACTOR = 80  # Reduced from 128 for less volatility, still higher than original 32
SCORE_DIFF_MULTIPLIER = 0.15 # Reduced from 0.2

# File paths
DEFENSE_FILE = "defense.txt"
OFFENSE_FILE = "offense.txt"
DEFENSE_BACKUP = "defense_backup.txt"
OFFENSE_BACKUP = "offense_backup.txt"
DEFENSE_HISTORY_FILE = "defense_history.txt"
OFFENSE_HISTORY_FILE = "offense_history.txt"

# List of players
PLAYERS = ["Hana", "Marko", "Ante", "Vedran", "Rade", "Fabek", "Grizli", "Turk", "Ema", "Karla", "Katarina"]

def load_players(file_path):
    """Load players and their stats from a file."""
    players = {}
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            lines = f.readlines()
            if len(lines) > 0 and not lines[0].strip().startswith("Name"):
                # Old format without headers, add default stats
                for line in lines:
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        name = " ".join(parts[:-1])  # Name might contain spaces
                        elo = int(parts[-1])
                        players[name] = {
                            "won": 0,
                            "lost": 0,
                            "played": 0,
                            "goals_for": 0,
                            "goals_against": 0,
                            "elo": elo
                        }
            else:
                # Skip header
                for line in lines[1:]:
                    parts = line.strip().split(' - ')
                    if len(parts) >= 7:
                        name = parts[0]
                        won = int(parts[1])
                        lost = int(parts[2])
                        played = int(parts[3])
                        goals_against = int(parts[4])
                        goals_for = int(parts[5])
                        elo = int(parts[6])
                        players[name] = {
                            "won": won,
                            "lost": lost,
                            "played": played,
                            "goals_for": goals_for,
                            "goals_against": goals_against,
                            "elo": elo
                        }
    return players

def save_players(file_path, players):
    """Save players and their stats to a file, sorted by Elo rating."""
    with open(file_path, 'w') as f:
        # Write header
        f.write("Name - Won - Lost - Played - Goals Against - Goals For - Elo\n")
        # Sort players by Elo rating (descending)
        sorted_players = sorted(players.items(), key=lambda item: item[1]['elo'], reverse=True)
        # Write player data
        for name, stats in sorted_players:
            f.write(f"{name} - {stats['won']} - {stats['lost']} - {stats['played']} - {stats['goals_against']} - {stats['goals_for']} - {stats['elo']}\n")

def log_elo_change(file_path, player_name, new_elo, match_info):
    """Log the Elo change for a player to track history."""
    # Create file with header if it doesn't exist
    if not os.path.exists(file_path):
        with open(file_path, 'w') as f:
            f.write("Timestamp - Name - Elo - Match Info\n")
    
    # Append the new Elo rating with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(file_path, 'a') as f:
        f.write(f"{timestamp} - {player_name} - {new_elo} - {match_info}\n")

def calculate_expected_score(player_elo, opponent_elo):
    """Calculate the expected score based on Elo ratings."""
    return 1 / (1 + math.pow(10, (opponent_elo - player_elo) / 400))

def update_elo(player_elo, expected_score, actual_score, score_diff=None):
    """Update the Elo rating based on the expected and actual scores."""
    base_change = K_FACTOR * (actual_score - expected_score)
    
    # Add score difference impact for more dynamic changes
    if score_diff is not None:
        score_impact = abs(score_diff) * SCORE_DIFF_MULTIPLIER
        # Increase cap to allow for larger changes
        score_impact = min(score_impact, 1.0)
        base_change *= (1 + score_impact)
    
    return player_elo + base_change

def create_backup(source_file, backup_file):
    """Create a backup of the current file."""
    if os.path.exists(source_file):
        shutil.copy2(source_file, backup_file)
        print(f"Backup created: {backup_file}")

def select_player(role):
    """Let the user select a player from the predefined list."""
    while True:
        print(f"\nSelect a {role} player:")
        for i, player in enumerate(PLAYERS, 1):
            print(f"{i}. {player}")
        
        choice = input("Enter player number (or type the name): ")
        
        # Check if input is a number
        if choice.isdigit() and 1 <= int(choice) <= len(PLAYERS):
            return PLAYERS[int(choice) - 1]
        
        # Check if input matches a player name
        for player in PLAYERS:
            if choice.lower() == player.lower():
                return player
        
        print("Invalid selection. Please try again.")

def initialize_player(players_dict, name):
    """Initialize a new player with default stats."""
    if name not in players_dict:
        players_dict[name] = {
            "won": 0,
            "lost": 0,
            "played": 0,
            "goals_for": 0,
            "goals_against": 0,
            "elo": DEFAULT_ELO
        }
    return players_dict

def main():
    # Create files if they don't exist
    for file_path in [DEFENSE_FILE, OFFENSE_FILE, DEFENSE_BACKUP, OFFENSE_BACKUP]:
        if not os.path.exists(file_path):
            directory = os.path.dirname(file_path)
            if directory and not os.path.exists(directory):
                os.makedirs(directory)
            with open(file_path, 'w') as f:
                if file_path in [DEFENSE_FILE, OFFENSE_FILE]:
                    f.write("Name - Won - Lost - Played - Goals Against - Goals For - Elo\n")

    # Create backups of current files
    create_backup(DEFENSE_FILE, DEFENSE_BACKUP)
    create_backup(OFFENSE_FILE, OFFENSE_BACKUP)

    # Load existing players
    defense_players = load_players(DEFENSE_FILE)
    offense_players = load_players(OFFENSE_FILE)

    print("ELO Foosball Tracker")
    print("===================")
    
    # Get players through selection
    print("\nSelect Team 1:")
    defense_player1 = select_player("defense")
    offense_player1 = select_player("offense")
    
    print("\nSelect Team 2:")
    defense_player2 = select_player("defense")
    offense_player2 = select_player("offense")
    
    # Get scores
    team1_score = int(input(f"\nEnter score for {defense_player1}/{offense_player1}: "))
    team2_score = int(input(f"Enter score for {defense_player2}/{offense_player2}: "))
    
    # Ensure players exist in the dictionaries with proper stats
    defense_players = initialize_player(defense_players, defense_player1)
    defense_players = initialize_player(defense_players, defense_player2)
    offense_players = initialize_player(offense_players, offense_player1)
    offense_players = initialize_player(offense_players, offense_player2)
    
    # Store original Elo values to track changes
    old_elo_defense1 = defense_players[defense_player1]["elo"]
    old_elo_offense1 = offense_players[offense_player1]["elo"]
    old_elo_defense2 = defense_players[defense_player2]["elo"]
    old_elo_offense2 = offense_players[offense_player2]["elo"]
    
    # Calculate team Elo ratings (average of the players)
    team1_elo = (defense_players[defense_player1]["elo"] + offense_players[offense_player1]["elo"]) / 2
    team2_elo = (defense_players[defense_player2]["elo"] + offense_players[offense_player2]["elo"]) / 2
    
    # Calculate expected scores
    team1_expected = calculate_expected_score(team1_elo, team2_elo)
    team2_expected = 1 - team1_expected
    
    # Calculate actual scores (normalized to sum to 1)
    total_score = team1_score + team2_score
    team1_actual = team1_score / total_score
    team2_actual = team2_score / total_score
    
    # Calculate score difference
    score_diff = team1_score - team2_score
    
    # Update Elo ratings with score difference impact
    defense_players[defense_player1]["elo"] = round(update_elo(defense_players[defense_player1]["elo"], team1_expected, team1_actual, score_diff))
    offense_players[offense_player1]["elo"] = round(update_elo(offense_players[offense_player1]["elo"], team1_expected, team1_actual, score_diff))
    defense_players[defense_player2]["elo"] = round(update_elo(defense_players[defense_player2]["elo"], team2_expected, team2_actual, -score_diff))
    offense_players[offense_player2]["elo"] = round(update_elo(offense_players[offense_player2]["elo"], team2_expected, team2_actual, -score_diff))
    
    # Create match info string for history
    match_info = f"{defense_player1}/{offense_player1} {team1_score}-{team2_score} {defense_player2}/{offense_player2}"
    
    # Log Elo changes to history files
    log_elo_change(DEFENSE_HISTORY_FILE, defense_player1, defense_players[defense_player1]["elo"], match_info)
    log_elo_change(OFFENSE_HISTORY_FILE, offense_player1, offense_players[offense_player1]["elo"], match_info)
    log_elo_change(DEFENSE_HISTORY_FILE, defense_player2, defense_players[defense_player2]["elo"], match_info)
    log_elo_change(OFFENSE_HISTORY_FILE, offense_player2, offense_players[offense_player2]["elo"], match_info)
    
    # Update other stats
    # Team 1
    if team1_score > team2_score:
        defense_players[defense_player1]["won"] += 1
        offense_players[offense_player1]["won"] += 1
        defense_players[defense_player2]["lost"] += 1
        offense_players[offense_player2]["lost"] += 1
    else:
        defense_players[defense_player1]["lost"] += 1
        offense_players[offense_player1]["lost"] += 1
        defense_players[defense_player2]["won"] += 1
        offense_players[offense_player2]["won"] += 1
    
    defense_players[defense_player1]["played"] += 1
    offense_players[offense_player1]["played"] += 1
    defense_players[defense_player2]["played"] += 1
    offense_players[offense_player2]["played"] += 1
    
    defense_players[defense_player1]["goals_for"] += team1_score
    offense_players[offense_player1]["goals_for"] += team1_score
    defense_players[defense_player1]["goals_against"] += team2_score
    offense_players[offense_player1]["goals_against"] += team2_score
    
    defense_players[defense_player2]["goals_for"] += team2_score
    offense_players[offense_player2]["goals_for"] += team2_score
    defense_players[defense_player2]["goals_against"] += team1_score
    offense_players[offense_player2]["goals_against"] += team1_score
    
    # Save updated ratings
    save_players(DEFENSE_FILE, defense_players)
    save_players(OFFENSE_FILE, offense_players)
    
    # Display updated ratings and stats for the match participants
    print("\nUpdated Ratings and Stats (Match Participants):")
    print(f"{defense_player1} (Defense):")
    print(f"  Elo: {old_elo_defense1} → {defense_players[defense_player1]['elo']} ({defense_players[defense_player1]['elo'] - old_elo_defense1:+d}) W/L/P: {defense_players[defense_player1]['won']}/{defense_players[defense_player1]['lost']}/{defense_players[defense_player1]['played']}")
    
    print(f"\n{offense_player1} (Offense):")
    print(f"  Elo: {old_elo_offense1} → {offense_players[offense_player1]['elo']} ({offense_players[offense_player1]['elo'] - old_elo_offense1:+d}) W/L/P: {offense_players[offense_player1]['won']}/{offense_players[offense_player1]['lost']}/{offense_players[offense_player1]['played']}")
    
    print(f"\n{defense_player2} (Defense):")
    print(f"  Elo: {old_elo_defense2} → {defense_players[defense_player2]['elo']} ({defense_players[defense_player2]['elo'] - old_elo_defense2:+d}) W/L/P: {defense_players[defense_player2]['won']}/{defense_players[defense_player2]['lost']}/{defense_players[defense_player2]['played']}")
    
    print(f"\n{offense_player2} (Offense):")
    print(f"  Elo: {old_elo_offense2} → {offense_players[offense_player2]['elo']} ({offense_players[offense_player2]['elo'] - old_elo_offense2:+d}) W/L/P: {offense_players[offense_player2]['won']}/{offense_players[offense_player2]['lost']}/{offense_players[offense_player2]['played']}")

    # Display full sorted rankings
    print("\n--- Current Rankings ---")
    print("\nDefense Rankings:")
    sorted_defense = sorted(defense_players.items(), key=lambda item: item[1]['elo'], reverse=True)
    for name, stats in sorted_defense:
        print(f"  {name}: {stats['elo']} (W/L: {stats['won']}/{stats['lost']})")

    print("\nOffense Rankings:")
    sorted_offense = sorted(offense_players.items(), key=lambda item: item[1]['elo'], reverse=True)
    for name, stats in sorted_offense:
        print(f"  {name}: {stats['elo']} (W/L: {stats['won']}/{stats['lost']})")
    
    print("\nIf you made an error, you can revert to the backup files.")
    print("Elo history has been updated for plotting.")

if __name__ == "__main__":
    main() 
