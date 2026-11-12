fn main() {
    println!("cargo:rustc-check-cfg=cfg(near_abi)");
    println!("cargo:rerun-if-env-changed=CARGO_NEAR_ABI_GENERATION");
    if std::env::var_os("CARGO_NEAR_ABI_GENERATION").is_some() {
        println!("cargo:rustc-cfg=near_abi");
    }
}
