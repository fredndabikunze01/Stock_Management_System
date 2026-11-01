package com.example.stockmanagement.repository;

import com.example.stockmanagement.model.Product;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {
    boolean existsByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    List<Product> findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByNameAsc(
            String name, String code);

    List<Product> findAllByOrderByNameAsc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    long countByQuantityGreaterThanAndQuantityLessThanEqual(int minimum, int threshold);
    long countByQuantity(int quantity);

    @Query("select coalesce(sum(p.quantity), 0) from Product p")
    long sumQuantities();
}
