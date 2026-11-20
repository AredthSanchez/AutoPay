package com.aredth.autopay;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;
interface InvoiceRepository extends JpaRepository<Invoice,UUID>{
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select i from Invoice i where i.id = :id") Optional<Invoice> locked(UUID id);
}
interface AttemptRepository extends JpaRepository<PaymentAttempt,UUID>{
 boolean existsByInvoiceIdAndStateIn(UUID invoiceId,Collection<String> states);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from PaymentAttempt a where a.id = :id") Optional<PaymentAttempt> locked(UUID id);
}
interface ClientRepository extends JpaRepository<Client,UUID>{}
interface AttachmentRepository extends JpaRepository<InvoiceAttachment,UUID>{
 List<InvoiceAttachment> findByInvoiceIdOrderByCreatedAtDesc(UUID invoiceId);
}
