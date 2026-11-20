package com.aredth.autopay;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;import java.math.*;import java.time.*;import javax.crypto.*;import javax.crypto.spec.*;import java.nio.charset.StandardCharsets;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:voice;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop","autopay.live=true","autopay.public-url=https://autopay.example","autopay.twilio.token=test-token"}) @AutoConfigureMockMvc
class VoiceWebhookTest {
 @Autowired MockMvc mvc;@Autowired InvoiceRepository invoices;@Autowired AttemptRepository attempts;
 String sign(String url,Map<String,String> fields)throws Exception{StringBuilder b=new StringBuilder(url);new TreeMap<>(fields).forEach((k,v)->b.append(k).append(v));Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec("test-token".getBytes(StandardCharsets.UTF_8),"HmacSHA1"));return Base64.getEncoder().encodeToString(mac.doFinal(b.toString().getBytes(StandardCharsets.UTF_8)));}
 @Test void signedPaymentIsIdempotentAndMatchesCall()throws Exception{Invoice i=new Invoice();i.client="Test";i.total=new BigDecimal("10.00");i.dueDate=LocalDate.now();invoices.save(i);PaymentAttempt a=new PaymentAttempt();a.invoiceId=i.id;a.callSid="CA123";a.state="CALLING";attempts.save(a);String path="/webhooks/voice/"+a.id+"/payment";Map<String,String> fields=Map.of("CallSid","CA123","Result","success");String sig=sign("https://autopay.example"+path,fields);mvc.perform(post(path).param("CallSid","CA123").param("Result","success").header("X-Twilio-Signature","forged")).andExpect(status().isForbidden());assertEquals("OPEN",invoices.findById(i.id).orElseThrow().status);mvc.perform(post(path).param("CallSid","CA123").param("Result","success").header("X-Twilio-Signature",sig)).andExpect(status().isOk());mvc.perform(post(path).param("CallSid","CA123").param("Result","success").header("X-Twilio-Signature",sig)).andExpect(status().isOk());Invoice saved=invoices.findById(i.id).orElseThrow();assertEquals("PAID",saved.status);assertEquals(1,saved.activity.size());}
}
