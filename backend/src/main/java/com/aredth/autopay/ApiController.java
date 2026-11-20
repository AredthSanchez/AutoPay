package com.aredth.autopay;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.web.csrf.CsrfToken;
import jakarta.validation.Valid;
import java.util.*;
@RestController @RequestMapping("/api")
class ApiController {
 private final InvoiceService invoices; private final VoiceService voice; private final ClientService clients;
 ApiController(InvoiceService i,VoiceService v,ClientService c){invoices=i;voice=v;clients=c;}
 @GetMapping("/session") Map<String,Object> session(CsrfToken token){return Map.of("csrfToken",token.getToken(),"csrfHeader",token.getHeaderName(),"live",voice.ready(),"voiceSetup",voice.setup());}
 @GetMapping("/clients") List<Client> clients(){return clients.all();}
 @PostMapping("/clients") Client createClient(@Valid @RequestBody ClientService.Draft d){return clients.create(d);}
 record PaymentDetails(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Pattern(regexp="CHECK|ACH|BANK_TRANSFER|CARD|CASH|OTHER") String paymentMethod,@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Size(max=80) String checkNumber){}
 @PostMapping("/invoices/{id}/payment-details") Invoice paymentDetails(@PathVariable UUID id,@Valid @RequestBody PaymentDetails d){return invoices.paymentDetails(id,d.paymentMethod(),d.checkNumber());}
 record Notes(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Size(max=2000) String notes){}
 @PostMapping("/invoices/{id}/notes") Invoice notes(@PathVariable UUID id,@Valid @RequestBody Notes n){return invoices.notes(id,n.notes());}
 @GetMapping("/invoices/trash") List<Invoice> trash(){return invoices.trash();}
 @PostMapping("/invoices/{id}/delete") Invoice delete(@PathVariable UUID id){return invoices.delete(id);}
 @PostMapping("/invoices/{id}/restore") Invoice restore(@PathVariable UUID id){return invoices.restore(id);}
 @GetMapping("/invoices") List<Invoice> all(){return invoices.all();}
 @GetMapping("/invoices/{id}") Invoice get(@PathVariable UUID id){return invoices.get(id);}
 @PostMapping("/invoices") Invoice create(@Valid @RequestBody InvoiceService.Draft d){return invoices.create(d);}
 @PostMapping("/invoices/{id}/edit") Invoice edit(@PathVariable UUID id,@Valid @RequestBody InvoiceService.Update d){return invoices.update(id,d);}
 @PostMapping("/invoices/{id}/void") Invoice cancel(@PathVariable UUID id){return invoices.cancel(id);}
 record Simulation(String outcome){}
 @PostMapping("/invoices/{id}/simulate") Invoice simulate(@PathVariable UUID id,@RequestBody Simulation s){return invoices.simulate(id,s.outcome());}
 record CallConsent(@jakarta.validation.constraints.AssertTrue boolean authorized){}
 @PostMapping("/invoices/{id}/call") Map<String,String> call(@PathVariable UUID id,@Valid @RequestBody CallConsent consent){return voice.call(id);}
}
