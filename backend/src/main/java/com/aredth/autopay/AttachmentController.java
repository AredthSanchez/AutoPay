package com.aredth.autopay;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.core.io.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.time.Instant;
import java.io.IOException;
@RestController @RequestMapping("/api/invoices/{invoiceId}/attachments")
class AttachmentController {
 record View(UUID id,String name,long size,String mediaType,Instant createdAt){}
 final Path root;final AttachmentRepository files;final InvoiceService invoices;
 AttachmentController(@Value("${autopay.upload-dir:./data/attachments}") String directory,AttachmentRepository f,InvoiceService i)throws IOException{root=Path.of(directory).toAbsolutePath().normalize();Files.createDirectories(root);files=f;invoices=i;}
 View view(InvoiceAttachment f){return new View(f.id,f.name,f.size,f.mediaType,f.createdAt);}
 @GetMapping List<View> list(@PathVariable UUID invoiceId){invoices.get(invoiceId);return files.findByInvoiceIdOrderByCreatedAtDesc(invoiceId).stream().map(this::view).toList();}
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional
 View upload(@PathVariable UUID invoiceId,@RequestParam("file") MultipartFile file)throws IOException{
  Invoice i=invoices.lock(invoiceId);List<InvoiceAttachment> existing=files.findByInvoiceIdOrderByCreatedAtDesc(invoiceId);
  if(file.isEmpty()||file.getSize()>5*1024*1024)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Files must be between 1 byte and 5 MB");
  if(existing.size()>=10||existing.stream().mapToLong(f->f.size).sum()+file.getSize()>25L*1024*1024)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invoice attachment limit reached");
  InvoiceAttachment f=new InvoiceAttachment();f.invoiceId=invoiceId;f.name=Optional.ofNullable(file.getOriginalFilename()).orElse("attachment").replaceAll("[\\\\/\\p{Cntrl}]","_");if(f.name.length()>200)f.name=f.name.substring(f.name.length()-200);if(f.name.isBlank())f.name="attachment";f.size=file.getSize();f.mediaType="application/octet-stream";
  Path target=root.resolve(f.id.toString());try{try(java.io.InputStream stream=file.getInputStream()){Files.copy(stream,target);}files.saveAndFlush(f);i.event("Attachment added");return view(f);}catch(Exception e){Files.deleteIfExists(target);throw e;}
 }
 InvoiceAttachment owned(UUID invoiceId,UUID id){invoices.get(invoiceId);InvoiceAttachment f=files.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));if(!f.invoiceId.equals(invoiceId))throw new ResponseStatusException(HttpStatus.NOT_FOUND);return f;}
 @GetMapping("/{id}/download") ResponseEntity<Resource> download(@PathVariable UUID invoiceId,@PathVariable UUID id){InvoiceAttachment f=owned(invoiceId,id);Path path=root.resolve(f.id.toString());if(!Files.isRegularFile(path))throw new ResponseStatusException(HttpStatus.NOT_FOUND);return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).contentLength(f.size).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(f.name,StandardCharsets.UTF_8).build().toString()).header("X-Content-Type-Options","nosniff").body(new FileSystemResource(path));}
 @PostMapping("/{id}/remove") @Transactional Map<String,Boolean> remove(@PathVariable UUID invoiceId,@PathVariable UUID id)throws IOException{Invoice i=invoices.lock(invoiceId);InvoiceAttachment f=owned(invoiceId,id);Files.deleteIfExists(root.resolve(f.id.toString()));files.delete(f);i.event("Attachment removed");return Map.of("removed",true);}
}
