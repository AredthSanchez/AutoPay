package com.aredth.autopay;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import com.fasterxml.jackson.databind.ObjectMapper;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:test;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop"}) @AutoConfigureMockMvc
class InvoiceIntegrationTest {
 @Autowired MockMvc mvc; @Autowired AttemptRepository attempts; @Autowired ObjectMapper json;
 String draft="{\"client\":\"Test Co\",\"email\":\"test@example.com\",\"phone\":\"+19155550100\",\"dueDate\":\"2027-01-10\",\"notes\":\"\",\"items\":[{\"description\":\"Development\",\"quantity\":3,\"unitPrice\":19.99}]}";
 @Test void basicLogin()throws Exception{mvc.perform(get("/api/session").with(httpBasic("admin","local-demo-change-me"))).andExpect(status().isOk()).andExpect(jsonPath("$.csrfToken").isNotEmpty());}
 @Test void authenticationAndCsrf()throws Exception{mvc.perform(get("/api/invoices")).andExpect(status().isUnauthorized());mvc.perform(post("/api/invoices").with(user("admin")).contentType("application/json").content(draft)).andExpect(status().isForbidden());}
 @Test void totalsAndPaymentAreConsistent()throws Exception{String body=mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(59.97)).andReturn().getResponse().getContentAsString();String id=json.readTree(body).get("id").asText();mvc.perform(post("/api/invoices/"+id+"/simulate").with(user("admin")).with(csrf()).contentType("application/json").content("{\"outcome\":\"failed\"}")).andExpect(jsonPath("$.status").value("OPEN"));mvc.perform(post("/api/invoices/"+id+"/simulate").with(user("admin")).with(csrf()).contentType("application/json").content("{\"outcome\":\"success\"}")).andExpect(jsonPath("$.status").value("PAID"));mvc.perform(post("/api/invoices/"+id+"/simulate").with(user("admin")).with(csrf()).contentType("application/json").content("{\"outcome\":\"success\"}")).andExpect(status().isConflict());}
 @Test void invalidMoneyAndUnsignedWebhookRejected()throws Exception{mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft.replace("19.99","-1"))).andExpect(status().isBadRequest());mvc.perform(post("/webhooks/voice/00000000-0000-0000-0000-000000000001/payment").param("Result","success")).andExpect(status().isForbidden());}

 @Test void standaloneClientAndDuplicateEmail()throws Exception{
 String client="{\"name\":\"Standalone Client\",\"email\":\"standalone@example.com\",\"phone\":\"+19155550120\",\"notes\":\"Call in the afternoon\"}";
 mvc.perform(post("/api/clients").with(user("admin")).with(csrf()).contentType("application/json").content(client)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Standalone Client"));
 mvc.perform(get("/api/clients").with(user("admin"))).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.email == 'standalone@example.com')]").isNotEmpty());
 mvc.perform(post("/api/clients").with(user("admin")).with(csrf()).contentType("application/json").content(client)).andExpect(status().isConflict());
 }
 @Test void notesCanBeEditedAndReadinessIsHonest()throws Exception{
 String body=mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft)).andReturn().getResponse().getContentAsString();String id=json.readTree(body).get("id").asText();
 mvc.perform(post("/api/invoices/"+id+"/notes").with(user("admin")).with(csrf()).contentType("application/json").content("{\"notes\":\"Reference PO-123\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.notes").value("Reference PO-123"));
 mvc.perform(get("/api/invoices/"+id).with(user("admin"))).andExpect(jsonPath("$.notes").value("Reference PO-123"));
 mvc.perform(get("/api/session").with(user("admin"))).andExpect(jsonPath("$.live").value(false)).andExpect(jsonPath("$.voiceSetup.backend").value(true)).andExpect(jsonPath("$.voiceSetup.payConnector").value(false));
 mvc.perform(post("/api/invoices/"+id+"/call").with(user("admin")).with(csrf()).contentType("application/json").content("{\"authorized\":false}")).andExpect(status().isBadRequest());
 }

 @Test void attachmentLifecycleAndPaymentMetadata()throws Exception{
 String body=mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft)).andReturn().getResponse().getContentAsString();String id=json.readTree(body).get("id").asText();
 org.springframework.mock.web.MockMultipartFile file=new org.springframework.mock.web.MockMultipartFile("file","receipt.txt","text/plain","Receipt content".getBytes(java.nio.charset.StandardCharsets.UTF_8));
 String uploaded=mvc.perform(multipart("/api/invoices/"+id+"/attachments").file(file).with(user("admin")).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("receipt.txt")).andReturn().getResponse().getContentAsString();String fid=json.readTree(uploaded).get("id").asText();
 mvc.perform(get("/api/invoices/"+id+"/attachments").with(user("admin"))).andExpect(jsonPath("$[0].id").value(fid));
 mvc.perform(get("/api/invoices/"+id+"/attachments/"+fid+"/download").with(user("admin"))).andExpect(status().isOk()).andExpect(content().string("Receipt content")).andExpect(header().string("X-Content-Type-Options","nosniff"));
 mvc.perform(post("/api/invoices/"+id+"/payment-details").with(user("admin")).with(csrf()).contentType("application/json").content("{\"paymentMethod\":\"CHECK\",\"checkNumber\":\"1048\"}")).andExpect(status().isConflict());
 mvc.perform(post("/api/invoices/"+id+"/simulate").with(user("admin")).with(csrf()).contentType("application/json").content("{\"outcome\":\"success\"}")).andExpect(jsonPath("$.paidAt").isNotEmpty());
 mvc.perform(post("/api/invoices/"+id+"/payment-details").with(user("admin")).with(csrf()).contentType("application/json").content("{\"paymentMethod\":\"CHECK\",\"checkNumber\":\"1048\"}")).andExpect(jsonPath("$.checkNumber").value("1048"));
 mvc.perform(post("/api/invoices/"+id+"/payment-details").with(user("admin")).with(csrf()).contentType("application/json").content("{\"paymentMethod\":\"ACH\",\"checkNumber\":\"1048\"}")).andExpect(jsonPath("$.paymentMethod").value("ACH")).andExpect(jsonPath("$.checkNumber").isEmpty());
 mvc.perform(post("/api/invoices/"+id+"/attachments/"+fid+"/remove").with(user("admin")).with(csrf()).contentType("application/json").content("{}")).andExpect(status().isOk());
 mvc.perform(get("/api/invoices/"+id+"/attachments/"+fid+"/download").with(user("admin"))).andExpect(status().isNotFound());
 }

 @Test void editEveryInvoiceFieldAndBlockActiveCalls()throws Exception{
 String created=mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft)).andReturn().getResponse().getContentAsString();String id=json.readTree(created).get("id").asText();
 com.fasterxml.jackson.databind.node.ObjectNode details=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft);details.put("client","Edited Client");details.put("email","edited@example.com");details.put("dueDate","2026-10-01");details.put("notes","Edited note");((com.fasterxml.jackson.databind.node.ObjectNode)details.withArray("items").get(0)).put("quantity",2).put("unitPrice",99.95);
 com.fasterxml.jackson.databind.node.ObjectNode update=json.createObjectNode();update.set("invoice",details);update.put("number","MANUAL-EDIT-1");update.put("status","PAID");update.put("paymentDate","2026-10-03");update.put("paymentMethod","CHECK");update.put("checkNumber","2026");
 mvc.perform(post("/api/invoices/"+id+"/edit").with(user("admin")).with(csrf()).contentType("application/json").content(update.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.number").value("MANUAL-EDIT-1")).andExpect(jsonPath("$.client").value("Edited Client")).andExpect(jsonPath("$.dueDate").value("2026-10-01")).andExpect(jsonPath("$.paymentDate").value("2026-10-03")).andExpect(jsonPath("$.total").value(199.90)).andExpect(jsonPath("$.status").value("PAID")).andExpect(jsonPath("$.checkNumber").value("2026"));
 PaymentAttempt active=new PaymentAttempt();active.invoiceId=java.util.UUID.fromString(id);active.state="CALLING";attempts.save(active);
 mvc.perform(post("/api/invoices/"+id+"/edit").with(user("admin")).with(csrf()).contentType("application/json").content(update.toString())).andExpect(status().isConflict());
 }

 @Test void deletionIsRestorable()throws Exception{
 String created=mvc.perform(post("/api/invoices").with(user("admin")).with(csrf()).contentType("application/json").content(draft)).andReturn().getResponse().getContentAsString();String id=json.readTree(created).get("id").asText();
 mvc.perform(post("/api/invoices/"+id+"/delete").with(user("admin")).with(csrf()).contentType("application/json").content("{}")).andExpect(status().isOk());
 mvc.perform(get("/api/invoices/"+id).with(user("admin"))).andExpect(status().isNotFound());
 mvc.perform(get("/api/invoices/trash").with(user("admin"))).andExpect(jsonPath("$[?(@.id == '"+id+"')]").isNotEmpty());
 mvc.perform(post("/api/invoices/"+id+"/restore").with(user("admin")).with(csrf()).contentType("application/json").content("{}")).andExpect(status().isOk());
 mvc.perform(get("/api/invoices/"+id).with(user("admin"))).andExpect(status().isOk()).andExpect(jsonPath("$.deleted").value(false));
 }
}
