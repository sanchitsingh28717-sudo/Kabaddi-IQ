from pydantic import BaseModel

class ResetPasswordRequest(BaseModel):
    method: str
    contact: str

class VerifyOTPRequest(BaseModel):
    contact: str
    otp: str
