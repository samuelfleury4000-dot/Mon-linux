from src.payments.payment_interface import StripeService, CryptoService

def checkout(method, amount):
    if method == "fiat":
        processor = StripeService()
    elif method == "crypto":
        processor = CryptoService()
    else:
        print("Erreur: Méthode inconnue")
        return
    processor.process_payment(amount)

if __name__ == "__main__":
    checkout("fiat", 100)
    checkout("crypto", 0.005)
