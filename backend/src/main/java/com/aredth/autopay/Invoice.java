package com.aredth.autopay;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
@Entity
class Invoice {
 @Id public UUID id=UUID.randomUUID();
 @Version public Long version;
 public String number="INV-"+id.toString().substring(0,8).toUpperCase();
 public String client,email,phone;
 public LocalDate dueDate;
 public String status="OPEN";
 public boolean deleted=false;
 @Column(precision=19,scale=2) public BigDecimal total;
 @Column(length=2000) public String notes;
 public Instant createdAt=Instant.now();
 public Instant paidAt;
 public java.time.LocalDate paymentDate;
 @Column(length=80) public String checkNumber;
 public String paymentMethod;
 @ElementCollection(fetch=FetchType.EAGER) @OrderColumn public List<Line> items=new ArrayList<>();
 @ElementCollection(fetch=FetchType.EAGER) @OrderColumn public List<String> activity=new ArrayList<>();
 public void event(String message){activity.add(Instant.now()+" | "+message);}
 @Embeddable public static class Line {
  public String description; public int quantity;
  @Column(precision=19,scale=2) public BigDecimal unitPrice;
  public Line(){} public Line(String d,int q,BigDecimal p){description=d;quantity=q;unitPrice=p;}
 }
}
@Entity
class PaymentAttempt {
 @Id public UUID id=UUID.randomUUID();
 public UUID invoiceId; public String callSid; public String state="CREATED";
 public Instant createdAt=Instant.now();
 public Instant paidAt;
 public java.time.LocalDate paymentDate;
 @Column(length=80) public String checkNumber;
 public String paymentMethod;
}
