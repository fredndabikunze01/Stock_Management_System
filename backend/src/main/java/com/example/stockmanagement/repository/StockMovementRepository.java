package com.example.stockmanagement.repository;

import com.example.stockmanagement.model.StockMovement;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    List<StockMovement> findTop10ByOrderByCreatedAtDesc();
    List<StockMovement> findAllByOrderByCreatedAtDesc();
    boolean existsByProductId(Long productId);
}
