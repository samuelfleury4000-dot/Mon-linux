import random
import json

def get_game_result(game_type, bet_amount):
    # Taux de retour casino (ex: 95% RTP, 5% House Edge)
    # Dans un vrai casino, le serveur décide du résultat selon des probas strictes
    
    if game_type == "dice":
        # Exemple: 1/6 chances de gagner x5
        roll = random.randint(1, 6)
        win = roll == 6
        multiplier = 5 if win else 0
        
    elif game_type == "crash":
        # Exemple: crash entre 1.00 et 2.00
        point = round(random.uniform(1.0, 2.0), 2)
        win = point > 1.2 # Seuil de sécurité
        multiplier = point if win else 0
        
    return {"win": win, "multiplier": multiplier, "payout": round(bet_amount * multiplier, 2)}
