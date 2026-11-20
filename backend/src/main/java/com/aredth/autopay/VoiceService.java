package com.aredth.autopay;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.*;
@Service @Transactional
class VoiceService {
 final boolean live; final String base,sid,token,from,connector;
 private final InvoiceService invoices; private final AttemptRepository attempts; private final ObjectMapper json;
 VoiceService(InvoiceService i,AttemptRepository a,ObjectMapper j,@Value("${autopay.live}") boolean l,@Value("${autopay.public-url}") String b,@Value("${autopay.twilio.sid}") String s,@Value("${autopay.twilio.token}") String t,@Value("${autopay.twilio.from}") String f,@Value("${autopay.twilio.connector}") String c){invoices=i;attempts=a;json=j;live=l;base=b.replaceAll("/$","");sid=s;token=t;from=f;connector=c;}
 Map<String,Boolean> setup(){return Map.of("backend",true,"publicUrl",base.startsWith("https://"),"accountSid",sid.matches("AC[0-9a-fA-F]{32}"),"authToken",!token.isBlank(),"fromNumber",from.matches("\\+[1-9][0-9]{7,14}"),"payConnector",!connector.isBlank(),"enabled",live);}
 boolean ready(){return setup().values().stream().allMatch(Boolean::booleanValue);}
 String url(UUID id,String action){return base+"/webhooks/voice/"+id+"/"+action;}
 static String enc(String s){return URLEncoder.encode(s,StandardCharsets.UTF_8);}
 @Transactional(noRollbackFor=ResponseStatusException.class)
 Map<String,String> call(UUID id){if(!ready())throw new ResponseStatusException(HttpStatus.CONFLICT,"Live voice payments are not configured");Invoice i=invoices.lock(id);invoices.open(i);if(i.phone==null||!i.phone.matches("\\+[1-9][0-9]{7,14}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"An E.164 phone number is required");if(attempts.existsByInvoiceIdAndStateIn(id,List.of("CREATED","CALLING","UNKNOWN")))throw new ResponseStatusException(HttpStatus.CONFLICT,"A payment call is already active");PaymentAttempt a=new PaymentAttempt();a.invoiceId=id;attempts.save(a);
  try{String form="To="+enc(i.phone)+"&From="+enc(from)+"&Url="+enc(url(a.id,"instructions"))+"&Method=POST&StatusCallback="+enc(url(a.id,"status"))+"&StatusCallbackMethod=POST&StatusCallbackEvent=completed";
   HttpRequest req=HttpRequest.newBuilder(URI.create("https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Calls.json")).timeout(java.time.Duration.ofSeconds(20)).header("Authorization","Basic "+Base64.getEncoder().encodeToString((sid+":"+token).getBytes(StandardCharsets.UTF_8))).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)).build();
   HttpResponse<String> res=HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString());if(res.statusCode()/100!=2){a.state=res.statusCode()>=500?"UNKNOWN":"FAILED";i.event("Voice call request did not succeed; check provider dashboard");throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Provider did not confirm the call; inspect the provider dashboard before retrying");}a.callSid=json.readTree(res.body()).path("sid").asText();if(a.callSid.isBlank())throw new IllegalStateException("Missing call ID");a.state="CALLING";i.event("Voice payment call requested");return Map.of("status","CALLING","attemptId",a.id.toString());
  }catch(ResponseStatusException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();a.state="UNKNOWN";i.event("Voice call outcome unknown — reconcile in provider dashboard");throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Call request interrupted; check provider dashboard");}catch(Exception e){a.state="UNKNOWN";i.event("Voice call outcome unknown — reconcile in provider dashboard");throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Unable to confirm call; check provider dashboard before retrying");}
 }
 void verify(UUID id,String action,Map<String,String> params,String signature){if(!live||token.isBlank()||signature==null)throw new ResponseStatusException(HttpStatus.FORBIDDEN);try{StringBuilder data=new StringBuilder(url(id,action));new TreeMap<>(params).forEach((k,v)->data.append(k).append(v));Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(token.getBytes(StandardCharsets.UTF_8),"HmacSHA1"));byte[] expected=Base64.getEncoder().encode(mac.doFinal(data.toString().getBytes(StandardCharsets.UTF_8)));if(!MessageDigest.isEqual(expected,signature.getBytes(StandardCharsets.UTF_8)))throw new ResponseStatusException(HttpStatus.FORBIDDEN);}catch(ResponseStatusException e){throw e;}catch(Exception e){throw new ResponseStatusException(HttpStatus.FORBIDDEN);}}
 PaymentAttempt attempt(UUID id,Map<String,String> p){PaymentAttempt a=attempts.locked(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));if(a.callSid==null||!a.callSid.equals(p.get("CallSid")))throw new ResponseStatusException(HttpStatus.FORBIDDEN);return a;}
 static String xml(String v){return v.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");}
 String instructions(UUID id,Map<String,String> p){PaymentAttempt a=attempt(id,p);Invoice i=invoices.lock(a.invoiceId);if(!a.state.equals("CALLING")||!i.status.equals("OPEN"))return "<Response><Say>This invoice is not available for payment.</Say><Hangup/></Response>";return "<Response><Say>This is AutoPay. You can pay invoice "+xml(i.number)+" for "+i.total.toPlainString()+" US dollars. Follow the secure payment prompts to continue.</Say><Pay chargeAmount=\""+i.total.toPlainString()+"\" currency=\"usd\" paymentConnector=\""+xml(connector)+"\" action=\""+xml(url(id,"payment"))+"\" method=\"POST\"/><Hangup/></Response>";}
 String payment(UUID id,Map<String,String> p){PaymentAttempt a=attempt(id,p);Invoice i=invoices.lock(a.invoiceId);if(a.state.equals("SUCCEEDED"))return "<Response><Say>Payment already recorded. Thank you.</Say></Response>";if("success".equals(p.get("Result"))){if(!i.status.equals("OPEN"))throw new ResponseStatusException(HttpStatus.CONFLICT);a.state="SUCCEEDED";i.status="PAID";i.paidAt=java.time.Instant.now();i.paymentDate=java.time.LocalDate.now(java.time.ZoneOffset.UTC);i.paymentMethod="CARD";i.event("Voice payment confirmed by signed provider callback");return "<Response><Say>Your payment was confirmed. Thank you.</Say></Response>";}a.state="FAILED";i.event("Voice payment did not complete");return "<Response><Say>Your payment was not completed. Please contact the business.</Say></Response>";}
 void status(UUID id,Map<String,String> p){PaymentAttempt a=attempt(id,p);if(a.state.equals("CALLING")&&Set.of("completed","failed","busy","no-answer","canceled").contains(p.getOrDefault("CallStatus",""))){a.state="ENDED";invoices.lock(a.invoiceId).event("Voice call ended");}}
}
