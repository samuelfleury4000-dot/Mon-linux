class PaymentGateway:
    def process_payment(self, amount):
        raise NotImplementedError("Doit être implémenté")

class StripeService(PaymentGateway):
    def process_payment(self, amount):
        print(f"[FIAT] Traitement de {amount} via Stripe...")
        return True

class CryptoService(PaymentGateway):
    def process_payment(self, amount):
        print(f"[CRYPTO] Traitement de {amount} via Blockchain...")
        return True
