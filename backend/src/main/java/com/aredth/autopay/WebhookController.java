package com.aredth.autopay;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/webhooks/voice")
class WebhookController {
 private final VoiceService voice;WebhookController(VoiceService v){voice=v;}
 @PostMapping(value="/{id}/{action}",produces="application/xml") String handle(@PathVariable UUID id,@PathVariable String action,@RequestParam Map<String,String> params,@RequestHeader(value="X-Twilio-Signature",required=false) String signature){voice.verify(id,action,params,signature);return switch(action){case "instructions"->voice.instructions(id,params);case "payment"->voice.payment(id,params);case "status"->{voice.status(id,params);yield "<Response/>";}default->throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);};}
}
