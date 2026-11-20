package com.aredth.autopay;
import jakarta.persistence.*;
import java.util.*;
import java.time.Instant;
@Entity
class InvoiceAttachment {
 @Id public UUID id=UUID.randomUUID();
 public UUID invoiceId;
 public String name;
 public long size;
 public String mediaType;
 public Instant createdAt=Instant.now();
}
