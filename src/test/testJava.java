package com.example.test;

/**
 * 测试类，用于测试Arthas插件
 */
public class TestClass {
    private String name;
    private int age;

    /**
     * 构造函数
     * @param name 姓名
     * @param age 年龄
     */
    public TestClass(String name, int age) {
        this.name = name;
        this.age = age;
    }

    /**
     * 获取姓名
     * @return 姓名
     */
    public String getName() {
        return name;
    }

    /**
     * 设置姓名
     * @param name 姓名
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * 获取年龄
     * @return 年龄
     */
    public int getAge() {
        return age;
    }

    /**
     * 设置年龄
     * @param age 年龄
     */
    public void setAge(int age) {
        this.age = age;
    }

    /**
     * 打印信息
     */
    public void printInfo() {
        System.out.println("Name: " + name + ", Age: " + age);
    }

    /**
     * 计算某个数的平方
     * @param number 输入数字
     * @return 平方结果
     */
    public int square(int number) {
        return number * number;
    }

    /**
     * 可能抛出异常的方法
     * @param divisor 除数
     * @return 结果
     * @throws ArithmeticException 当除数为0时
     */
    public double divide(int divisor) throws ArithmeticException {
        if (divisor == 0) {
            throw new ArithmeticException("除数不能为0");
        }
        return age / (double) divisor;
    }
} 