package com.aredth.autopay;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
class Client {
 @Id public UUID id=UUID.randomUUID();
 public String name;
 @Column(unique=true,nullable=false) public String email;
 public String phone;
 @Column(length=2000) public String notes;
 public Instant createdAt=Instant.now();
}
