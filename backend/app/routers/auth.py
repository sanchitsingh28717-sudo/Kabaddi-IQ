from fastapi import APIRouter, HTTPException
import random
from twilio.rest import Client
import resend
from app.core.config import settings
from app.schemas.auth import ResetPasswordRequest, VerifyOTPRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

PENDING_OTPS = {}

# Initialize external messaging services
twilio_client = None
if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    except Exception as e:
        print(f"[WARN] Twilio client initialization failed: {e}")

if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    otp = str(random.randint(100000, 999999))
    if req.method == "phone":
        if req.contact != "+918353945200" and req.contact.replace(" ", "") != "+918353945200":
            raise HTTPException(status_code=403, detail="Not an authorized test phone number.")
        if not twilio_client:
            raise HTTPException(status_code=500, detail="Twilio is not configured on the server.")
        
        message_body = f"[KabaddiIQ] Your System Override OTP is {otp}. Do not share this key."
        try:
            message = twilio_client.messages.create(
                body=message_body, 
                from_=settings.TWILIO_PHONE_NUMBER, 
                to=req.contact
            )
            PENDING_OTPS[req.contact] = otp
            return {"status": "success", "message": "OTP sent.", "sid": message.sid}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    elif req.method == "email":
        if not settings.RESEND_API_KEY:
            raise HTTPException(status_code=500, detail="Resend is not configured on the server.")
        
        html_content = f"""
        <div style="font-family: monospace; background: #0e0e0e; color: #ffffff; padding: 40px; text-align: center; border: 1px solid #333;">
            <h2 style="color: #6366f1; letter-spacing: 2px;">KABADDI IQ - SYSTEM OVERRIDE</h2>
            <p>An emergency access recovery protocol was initiated.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #888;">YOUR DECRYPTION KEY IS:</p>
            <h1 style="font-size: 48px; letter-spacing: 10px; margin: 10px 0; color: #ffffff;">{otp}</h1>
            <p style="color: #ef4444; font-size: 10px; margin-top: 40px;">IF YOU DID NOT INITIATE THIS, SECURE YOUR ACCOUNT IMMEDIATELY.</p>
        </div>
        """
        try:
            resend.Emails.send({
                "from": "KabaddiIQ Override <onboarding@resend.dev>", 
                "to": [req.contact], 
                "subject": "System Override Decryption Key", 
                "html": html_content
            })
            PENDING_OTPS[req.contact] = otp
            return {"status": "success", "message": f"Recovery email dispatched to {req.contact}."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Invalid method.")

@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    expected_otp = PENDING_OTPS.get(req.contact)
    if not expected_otp:
        raise HTTPException(status_code=400, detail="No pending OTP for this contact.")
    if req.otp != expected_otp:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    del PENDING_OTPS[req.contact]
    return {"status": "success", "message": "OTP verified successfully"}
