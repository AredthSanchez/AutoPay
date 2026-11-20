package com.aredth.autopay;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;
@Service @Transactional
class ClientService {
 record Draft(@NotBlank @Size(max=150) String name,@NotBlank @Email @Size(max=200) String email,@Pattern(regexp="^$|\\+[1-9][0-9]{7,14}$") String phone,@Size(max=2000) String notes){}
 private final ClientRepository clients;private final InvoiceRepository invoices;
 ClientService(ClientRepository c,InvoiceRepository i){clients=c;invoices=i;}
 List<Client> all(){List<Client> result=new ArrayList<>(clients.findAll());Set<String> emails=new HashSet<>();result.forEach(c->emails.add(c.email.toLowerCase(Locale.ROOT)));for(Invoice i:invoices.findAll()){if(emails.add(i.email.toLowerCase(Locale.ROOT))){Client c=new Client();c.id=UUID.nameUUIDFromBytes(i.email.toLowerCase(Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.UTF_8));c.name=i.client;c.email=i.email;c.phone=i.phone;c.notes="";result.add(c);}}result.sort(Comparator.comparing(c->c.name.toLowerCase(Locale.ROOT)));return result;}
 Client create(Draft d){String email=d.email().trim().toLowerCase(Locale.ROOT);if(all().stream().anyMatch(c->c.email.equalsIgnoreCase(email)))throw new ResponseStatusException(HttpStatus.CONFLICT,"A client with that email already exists");Client c=new Client();c.name=d.name().trim();c.email=email;c.phone=d.phone()==null?"":d.phone();c.notes=d.notes()==null?"":d.notes();return clients.save(c);}
}
