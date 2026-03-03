package com.devops.todo.controller;

import com.devops.todo.dto.TaskDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class DemoController {
    @GetMapping("/tasks")
    public List<TaskDto> demo() {
        return List.of(
                new TaskDto(
                        "1",
                        "Test Task",
                        "Demo Data",
                        "q2",
                        null,
                        false,
                        System.currentTimeMillis(),
                        null
                )
        );
    }

}
